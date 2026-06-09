import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { verifyToken, getUserInfo, type AnlasInfo } from '@/services/novelai-service'

interface AuthState {
    token: string
    isVerified: boolean
    tier: string | null
    anlas: AnlasInfo | null
    isLoading: boolean
    error: string | null

    setToken: (token: string) => void
    login: (token: string) => Promise<boolean>
    refreshAnlas: () => Promise<void>
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: '',
            isVerified: false,
            tier: null,
            anlas: null,
            isLoading: false,
            error: null,

            setToken: (token) => set({ token }),

            login: async (token) => {
                if (!token.trim()) return false
                set({ isLoading: true, error: null })

                const result = await verifyToken(token)

                if (result.valid) {
                    set({ 
                        token, 
                        isVerified: true, 
                        tier: result.tier || null,
                        error: null 
                    })

                    // Fetch Anlas balance
                    const userInfo = await getUserInfo(token)
                    if (userInfo) {
                        set({ anlas: userInfo.anlas })
                    }

                    set({ isLoading: false })
                    return true
                } else {
                    set({ 
                        isVerified: false, 
                        tier: null, 
                        anlas: null, 
                        isLoading: false,
                        error: result.error || 'Authentication failed'
                    })
                    return false
                }
            },

            refreshAnlas: async () => {
                const { token, isVerified } = get()
                if (!token || !isVerified) return

                const userInfo = await getUserInfo(token)
                if (userInfo) {
                    set({ anlas: userInfo.anlas })
                }
            },

            logout: () => set({
                token: '',
                isVerified: false,
                tier: null,
                anlas: null,
                error: null
            }),
        }),
        {
            name: 'nai-assistant-auth',
            partialize: (state) => ({
                token: state.token,
                isVerified: state.isVerified,
                tier: state.tier,
            }),
        }
    )
)
