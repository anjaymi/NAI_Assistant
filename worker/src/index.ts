import { EmailService } from './utils/email';

export interface Env {
	DB: D1Database;
	QQ_APP_ID: string;
	QQ_APP_KEY: string;
	REDIRECT_URI: string;
	APP_SCHEME: string;
	RESEND_API_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const emailService = env.RESEND_API_KEY ? new EmailService(env.RESEND_API_KEY) : null;

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};



		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

        try {
		if (url.pathname === "/proxy/image" && request.method === "GET") {
			const imageUrl = url.searchParams.get("url");
			if (!imageUrl) {
				return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), { 
					status: 400, 
					headers: { "Content-Type": "application/json", ...corsHeaders } 
				});
			}

			try {
				const imageResponse = await fetch(imageUrl, {
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						"Referer": "https://danbooru.donmai.us/",
						"Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
					}
				});

				if (!imageResponse.ok) {
					return new Response(JSON.stringify({ error: `Upstream returned ${imageResponse.status}` }), { 
						status: imageResponse.status, 
						headers: { "Content-Type": "application/json", ...corsHeaders } 
					});
				}

				const imageHeaders = new Headers(imageResponse.headers);
				imageHeaders.set("Access-Control-Allow-Origin", "*");
				imageHeaders.set("Cache-Control", "public, max-age=86400");

				return new Response(imageResponse.body, {
					status: 200,
					headers: imageHeaders
				});
			} catch (e: any) {
				return new Response(JSON.stringify({ error: e.message }), { 
					status: 500, 
					headers: { "Content-Type": "application/json", ...corsHeaders } 
				});
			}
		}


		// --- Auth Routes (Simple) ---
		
		const hashPassword = async (password: string) => {
			const msgBuffer = new TextEncoder().encode(password);
			const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		};

		// 1. Register with Email (Optional)
		if (url.pathname === "/auth/register" && request.method === "POST") {
			const body: any = await request.json();
			const { username, password, email } = body;
			
			if (!username || !password || username.length < 3 || password.length < 6) {
				return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: corsHeaders });
			}

			const passwordHash = await hashPassword(password);
			const userId = crypto.randomUUID();
            const now = Date.now();

			try {
				await env.DB.prepare(
					"INSERT INTO users (id, username, password_hash, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)"
				).bind(userId, username, passwordHash, email || null, now, now).run();

				const token = btoa(JSON.stringify({ sub: userId, name: username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
				
				return new Response(JSON.stringify({ token, user: { id: userId, name: username, email } }), {
					headers: { "Content-Type": "application/json", ...corsHeaders }
				});
			} catch (e: any) {
				if (e.message.includes("UNIQUE constraint failed")) {
                    if (e.message.includes("users.email")) {
                        return new Response(JSON.stringify({ error: "Email already taken" }), { status: 409, headers: corsHeaders });
                    }
					return new Response(JSON.stringify({ error: "Username already taken" }), { status: 409, headers: corsHeaders });
				}
				return new Response(JSON.stringify({ error: "Registration failed: " + e.message }), { status: 500, headers: corsHeaders });
			}
		}

		// 2. Login
		if (url.pathname === "/auth/login" && request.method === "POST") {
			const body: any = await request.json();
			const { username, password } = body;

			if (!username || !password) {
				return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers: corsHeaders });
			}

            // Allow login by Username OR Email
			const user = await env.DB.prepare(
				"SELECT id, username, password_hash, email FROM users WHERE username = ? OR email = ?"
			).bind(username, username).first();

			if (!user) {
				return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers: corsHeaders });
			}

			const inputHash = await hashPassword(password);
			if (inputHash !== (user as any).password_hash) {
				return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers: corsHeaders });
			}

			// Update login time
			await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(Date.now(), (user as any).id).run();

			const token = btoa(JSON.stringify({ sub: (user as any).id, name: (user as any).username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
			
			return new Response(JSON.stringify({ token, user: { id: (user as any).id, name: (user as any).username, email: (user as any).email } }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

        // 2.1 Password Reset Request
        if (url.pathname === "/auth/reset-password-request" && request.method === "POST") {
            const body: any = await request.json();
            const { email } = body;

            if (!email) return new Response(JSON.stringify({ error: "Missing email" }), { status: 400, headers: corsHeaders });

            const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
            if (!user) {
                // Return success to prevent enumeration
                return new Response(JSON.stringify({ success: true, message: "If email exists, code sent" }), {
                     headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 10 * 60 * 1000; // 10 mins

            await env.DB.prepare("UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?")
                .bind(code, expires, (user as any).id).run();

            // Send Email
            if (!emailService) {
                return new Response(JSON.stringify({ error: "Email service is not configured" }), { status: 503, headers: corsHeaders });
            }
            await emailService.sendPasswordResetEmail(email, code);

            return new Response(JSON.stringify({ success: true, message: "Code sent" }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
        }

        // 2.2 Password Reset Verify & Change
        if (url.pathname === "/auth/reset-password-verify" && request.method === "POST") {
             const body: any = await request.json();
             const { email, code, newPassword } = body;

             if (!email || !code || !newPassword) {
                 return new Response(JSON.stringify({ error: "Missing input" }), { status: 400, headers: corsHeaders });
             }

             const user = await env.DB.prepare("SELECT id, verification_code, verification_expires FROM users WHERE email = ?").bind(email).first();
             
             if (!user || (user as any).verification_code !== code) {
                 return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: corsHeaders });
             }

             if (Date.now() > (user as any).verification_expires) {
                 return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: corsHeaders });
             }

             const newHash = await hashPassword(newPassword);
             await env.DB.prepare("UPDATE users SET password_hash = ?, verification_code = NULL, verification_expires = NULL WHERE id = ?")
                 .bind(newHash, (user as any).id).run();

             return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
        }

        // --- Auth Extraction (needed for bind-email and sync routes) ---
        const authHeader = request.headers.get("Authorization");
        let userId = "";
        if (authHeader) {
            try {
                const token = authHeader.split(" ")[1] || "";
                const payload = JSON.parse(atob(token));
                userId = payload.sub;
            } catch (e) {
                // Token parse failed, userId stays empty
            }
        }

        // 2.3 Bind Email Request (Authenticated)
        if (url.pathname === "/auth/bind-email-request" && request.method === "POST") {
            if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
            
            const body: any = await request.json();
            const { email } = body;

            if (!email) return new Response(JSON.stringify({ error: "Missing email" }), { status: 400, headers: corsHeaders });

            // Check if email taken
            const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
            if (existing) {
                return new Response(JSON.stringify({ error: "Email already used by another account" }), { status: 409, headers: corsHeaders });
            }

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 10 * 60 * 1000; // 10 mins

            const result = await env.DB.prepare("UPDATE users SET pending_email = ?, verification_code = ?, verification_expires = ? WHERE id = ?")
                .bind(email, code, expires, userId).run();

            if (result.meta && result.meta.changes === 0) {
                 return new Response(JSON.stringify({ error: "User not found or invalid token. Please log out and log in again." }), { status: 404, headers: corsHeaders });
            }

            // Send Email
            if (!emailService) {
                return new Response(JSON.stringify({ error: "Email service is not configured" }), { status: 503, headers: corsHeaders });
            }
            const emailResult = await emailService.sendVerificationEmail(email, code);
            if (!emailResult.success) {
                return new Response(JSON.stringify({ error: "Failed to send email", detail: String(emailResult.error) }), {
                    status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            return new Response(JSON.stringify({ success: true, message: "Verification code sent" }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 2.4 Bind Email Verify (Authenticated)
        if (url.pathname === "/auth/bind-email-verify" && request.method === "POST") {
            if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

            const body: any = await request.json();
            const { code } = body;

            if (!code) return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers: corsHeaders });

            const user = await env.DB.prepare("SELECT pending_email, verification_code, verification_expires FROM users WHERE id = ?").bind(userId).first();

            if (!user) {
                 return new Response(JSON.stringify({ error: "User not found. Please re-login." }), { status: 404, headers: corsHeaders });
            }

            if (!(user as any).pending_email) {
                 return new Response(JSON.stringify({ error: "No pending bind request found for this user." }), { status: 400, headers: corsHeaders });
            }

            if ((user as any).verification_code !== code) {
                return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: corsHeaders });
            }

            if (Date.now() > (user as any).verification_expires) {
                return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: corsHeaders });
            }

            // Commit Change
            try {
                await env.DB.prepare("UPDATE users SET email = ?, email_verified = 1, pending_email = NULL, verification_code = NULL, verification_expires = NULL WHERE id = ?")
                    .bind((user as any).pending_email, userId).run();

                return new Response(JSON.stringify({ success: true, email: (user as any).pending_email }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch(e: any) {
                if (e.message.includes("UNIQUE constraint failed")) {
                     return new Response(JSON.stringify({ error: "Email already taken" }), { status: 409, headers: corsHeaders });
                }
                throw e;
            }
        }

        // 2.5 Change Username (Authenticated)
        if (url.pathname === "/auth/change-username" && request.method === "POST") {
            if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

            const body: any = await request.json();
            const { newUsername } = body;

            if (!newUsername || newUsername.length < 3) {
                return new Response(JSON.stringify({ error: "Username must be at least 3 characters long" }), { status: 400, headers: corsHeaders });
            }

            const usernameToSet = newUsername.trim().toLowerCase();

            try {
                // Check if username is already taken
                const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(usernameToSet).first();
                if (existing) {
                    return new Response(JSON.stringify({ error: "Username already taken" }), { status: 409, headers: corsHeaders });
                }

                // Execute a batch of updates
                await env.DB.batch([
                    env.DB.prepare("UPDATE users SET username = ? WHERE id = ?").bind(usernameToSet, userId),
                    env.DB.prepare("UPDATE public_artists SET author_name = ? WHERE author_id = ?").bind(usernameToSet, userId),
                    env.DB.prepare("UPDATE public_wildcards SET author_name = ? WHERE author_id = ?").bind(usernameToSet, userId)
                ]);

                // Generate new token with new username
                const token = btoa(JSON.stringify({ sub: userId, name: usernameToSet, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));

                // Retrieve updated user
                const updatedUser = await env.DB.prepare("SELECT id, username, email FROM users WHERE id = ?").bind(userId).first();

                return new Response(JSON.stringify({ 
                    success: true, 
                    token, 
                    user: { id: (updatedUser as any).id, name: (updatedUser as any).username, email: (updatedUser as any).email } 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });

            } catch (e: any) {
                console.error("Change username error:", e);
                return new Response(JSON.stringify({ error: "Failed to change username: " + e.message }), { status: 500, headers: corsHeaders });
            }
        }


		// --- Sync Routes ---
		
		// Protected Routes Validation
		if (!authHeader && (url.pathname.startsWith("/sync") || url.pathname === "/share/create")) {
			return new Response("Unauthorized", { status: 401, headers: corsHeaders });
		}
		
		// Re-validate token for sync/share routes (stricter check)
		if (authHeader && !userId && (url.pathname.startsWith("/sync") || url.pathname === "/share/create")) {
			return new Response("Invalid Token", { status: 401, headers: corsHeaders });
		}

		// 3. Pull Updates
		if (url.pathname === "/sync/pull" && request.method === "GET") {
			const lastSync = parseInt(url.searchParams.get("last_sync") || "0");
			
			const { results } = await env.DB.prepare(
				"SELECT key, value, updated_at, deleted FROM user_data WHERE user_id = ? AND updated_at > ?"
			).bind(userId, lastSync).all();

			return new Response(JSON.stringify({ changes: results, timestamp: Date.now() }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

		// 4. Push Updates
		if (url.pathname === "/sync/push" && request.method === "POST") {
			const body: any = await request.json();
			const changes = body.changes || [];
			
			const stmt = env.DB.prepare(
				`INSERT INTO user_data (user_id, key, value, updated_at, deleted) 
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(user_id, key) DO UPDATE SET 
				 value = excluded.value, 
				 updated_at = excluded.updated_at,
				 deleted = excluded.deleted`
			);

			const batch = changes.map((change: any) => 
				stmt.bind(userId, change.key, change.value, change.updated_at, change.deleted ? 1 : 0)
			);

			await env.DB.batch(batch);

			return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}


		// --- Share Routes ---

		// 5. Create Share Code (24h validity)
		if (url.pathname === "/share/create" && request.method === "POST") {
			if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
			
			// Generate 6-digit code
			const code = Math.floor(100000 + Math.random() * 900000).toString();
			const now = Date.now();
			const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

			await env.DB.prepare(
				"INSERT INTO share_codes (code, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
			).bind(code, userId, now, expiresAt).run();

			return new Response(JSON.stringify({ code, expiresAt }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

		// 6. Import via Share Code
		if (url.pathname === "/share/import" && request.method === "POST") {
			const body: any = await request.json();
			const code = body.code;
			if (!code) return new Response("Missing code", { status: 400, headers: corsHeaders });

			// Verify Code
			const codeRecord = await env.DB.prepare(
				"SELECT user_id, expires_at FROM share_codes WHERE code = ?"
			).bind(code).first();

			if (!codeRecord) {
				return new Response(JSON.stringify({ error: "Invalid code" }), { status: 404, headers: corsHeaders });
			}

			if (Date.now() > (codeRecord.expires_at as number)) {
				return new Response(JSON.stringify({ error: "Code expired" }), { status: 410, headers: corsHeaders });
			}

			const targetUserId = codeRecord.user_id as string;

			// Fetch All Non-Deleted Data for that user
			const { results } = await env.DB.prepare(
				"SELECT key, value, updated_at FROM user_data WHERE user_id = ? AND deleted = 0"
			).bind(targetUserId).all();

			return new Response(JSON.stringify({ success: true, count: results.length, data: results }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}


		// --- Community Wildcards Routes ---

		// 7. Publish Wildcard
		if (url.pathname === "/wildcards/publish" && request.method === "POST") {
			if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
			
			const body: any = await request.json();
			const { name, content, description, tags } = body;
			
			if (!name || !content) {
				return new Response("Missing required fields", { status: 400, headers: corsHeaders });
			}

			const id = crypto.randomUUID();
			const now = Date.now();
            
            // Get user name for author info
            const user = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
            const authorName = (user as any)?.username || "Unknown";

			await env.DB.prepare(
				`INSERT INTO public_wildcards (id, name, content, author_id, author_name, description, tags, created_at, downloads) 
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
			).bind(id, name, content, userId, authorName, description || "", tags || "", now).run();

			return new Response(JSON.stringify({ success: true, id }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

		// 8. List Wildcards
		if (url.pathname === "/wildcards" && request.method === "GET") {
			const limit = parseInt(url.searchParams.get("limit") || "20");
			const offset = parseInt(url.searchParams.get("offset") || "0");
			const search = url.searchParams.get("search") || "";
            const sort = url.searchParams.get("sort") || "newest"; // newest, downloads

            let query = "SELECT id, name, author_name, description, tags, created_at, downloads FROM public_wildcards";
            const params: any[] = [];

            if (search) {
                query += " WHERE name LIKE ? OR description LIKE ? OR tags LIKE ?";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            
            if (sort === "downloads") {
                query += " ORDER BY downloads DESC";
            } else {
                query += " ORDER BY created_at DESC";
            }

            query += " LIMIT ? OFFSET ?";
            params.push(limit, offset);

			const { results } = await env.DB.prepare(query).bind(...params).all();
            
			return new Response(JSON.stringify({ wildcards: results }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

        // 9. Download Wildcard (Get Content + Increment)
        if (url.pathname.match(/^\/wildcards\/[a-f0-9-]+$/) && request.method === "GET") {
             const id = url.pathname.split("/").pop();
             
             const wildcard = await env.DB.prepare("SELECT * FROM public_wildcards WHERE id = ?").bind(id).first();
             
             if (!wildcard) {
                 return new Response("Not Found", { status: 404, headers: corsHeaders });
             }
             
             // Increment async
             ctx.waitUntil(env.DB.prepare("UPDATE public_wildcards SET downloads = downloads + 1 WHERE id = ?").bind(id).run());
             
             return new Response(JSON.stringify(wildcard), {
                 headers: { "Content-Type": "application/json", ...corsHeaders }
             });
        }


		// --- Community Artists Routes ---

		// 10. Publish Artist
		if (url.pathname === "/artists/publish" && request.method === "POST") {
			if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
			
			const body: any = await request.json();
			const { name, preview_base64, preview_url, description, tag } = body;
			
			if (!name) {
				return new Response("Missing artist name", { status: 400, headers: corsHeaders });
			}

            // Limit Base64 size to avoid huge payloads (e.g. 500KB)
            if (preview_base64 && preview_base64.length > 500 * 1024) {
                return new Response("Preview image too large (max 500KB)", { status: 400, headers: corsHeaders });
            }

            const now = Date.now();
            
            const user = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
            const authorName = (user as any)?.username || "Unknown";

            const existing = await env.DB.prepare("SELECT id, author_id FROM public_artists WHERE name = ?").bind(name).first();

            let id = crypto.randomUUID();
            
            if (existing) {
                id = (existing as any).id as string;
                
                await env.DB.prepare(
                    `UPDATE public_artists SET 
                        preview_base64 = ?, 
                        preview_url = ?, 
                        description = ?, 
                        tag = ?, 
                        author_name = ?, 
                        updated_at = ? 
                    WHERE id = ?`
                ).bind(
                    preview_base64 || "", 
                    preview_url || "", 
                    description || "", 
                    tag || "", 
                    authorName,
                    now, 
                    id
                ).run();
            } else {
    			await env.DB.prepare(
    				`INSERT INTO public_artists (id, name, preview_base64, preview_url, author_id, author_name, description, tag, created_at, downloads, count) 
    				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
    			).bind(id, name, preview_base64 || "", preview_url || "", userId, authorName, description || "", tag || "", now).run();
            }

			return new Response(JSON.stringify({ success: true, id, action: existing ? "updated" : "created" }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

		// 11. List Artists
		if (url.pathname === "/artists" && request.method === "GET") {
			const limit = parseInt(url.searchParams.get("limit") || "20");
			const offset = parseInt(url.searchParams.get("offset") || "0");
			const search = url.searchParams.get("search") || "";
            const sort = url.searchParams.get("sort") || "newest"; // newest, downloads

            let query = "SELECT id, name, author_name, description, tag, preview_base64, preview_url, created_at, downloads FROM public_artists";
            const params: any[] = [];

            if (search) {
                query += " WHERE name LIKE ? OR description LIKE ? OR tag LIKE ?";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            
            if (sort === "downloads") {
                query += " ORDER BY downloads DESC";
            } else {
                query += " ORDER BY created_at DESC";
            }

            query += " LIMIT ? OFFSET ?";
            params.push(limit, offset);

			const { results } = await env.DB.prepare(query).bind(...params).all();
            
			return new Response(JSON.stringify({ artists: results }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
		}

        // 12. Download/Get Artist Details
        if (url.pathname.match(/^\/artists\/[a-f0-9-]+$/) && request.method === "GET") {
             const id = url.pathname.split("/").pop();
             
             const artist = await env.DB.prepare("SELECT * FROM public_artists WHERE id = ?").bind(id).first();
             
             if (!artist) {
                 return new Response("Not Found", { status: 404, headers: corsHeaders });
             }
             
             // Increment async
             ctx.waitUntil(env.DB.prepare("UPDATE public_artists SET downloads = downloads + 1 WHERE id = ?").bind(id).run());
             
             return new Response(JSON.stringify(artist), {
                 headers: { "Content-Type": "application/json", ...corsHeaders }
             });
        }

		return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: `Worker Error: ${e.message}`, stack: e.stack }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
	},
};
