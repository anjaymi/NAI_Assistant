export type OutputImageFormat = 'png' | 'webp'

export async function convertGeneratedBase64ToFormat(
    base64Data: string,
    format: OutputImageFormat
): Promise<{ base64: string; mimeType: string; extension: OutputImageFormat }> {
    if (format === 'png') {
        return {
            base64: base64Data,
            mimeType: 'image/png',
            extension: 'png',
        }
    }

    const dataUrl = `data:image/png;base64,${base64Data}`
    const image = await loadImage(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height

    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('无法创建图像转换上下文')
    }

    context.drawImage(image, 0, 0)
    const webpDataUrl = canvas.toDataURL('image/webp', 0.98)

    return {
        base64: webpDataUrl.replace(/^data:image\/webp;base64,/, ''),
        mimeType: 'image/webp',
        extension: 'webp',
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = (error) => reject(error)
        image.src = src
    })
}
