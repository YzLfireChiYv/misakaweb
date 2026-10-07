const SHIFT = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
    20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
]

const TABLE = new Int32Array(64)
for (let i = 0; i < 64; i++) {
    TABLE[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
}

const rotl = (value: number, bits: number) => (value << bits) | (value >>> (32 - bits))

const hexWord = (value: number) => {
    const unsigned = value >>> 0
    let text = ''
    for (let i = 0; i < 4; i++) {
        text += ((unsigned >>> (8 * i)) & 0xff).toString(16).padStart(2, '0')
    }
    return text
}

/** UTF-8 MD5，返回小写十六进制。WBI 签名的查询串是 ASCII。 */
export const md5 = (message: string): string => {
    const bytes = new TextEncoder().encode(message)
    let length = bytes.length + 1
    while (length % 64 !== 56) {
        length++
    }
    const padded = new Uint8Array(length + 8)
    padded.set(bytes)
    padded[bytes.length] = 0x80
    const view = new DataView(padded.buffer)
    const bitLength = bytes.length * 8
    view.setUint32(length, bitLength >>> 0, true)
    view.setUint32(length + 4, Math.floor(bitLength / 4294967296), true)

    let a0 = 0x67452301
    let b0 = 0xefcdab89
    let c0 = 0x98badcfe
    let d0 = 0x10325476

    for (let offset = 0; offset < padded.length; offset += 64) {
        const words = new Int32Array(16)
        for (let index = 0; index < 16; index++) {
            words[index] = view.getInt32(offset + index * 4, true)
        }
        let a = a0
        let b = b0
        let c = c0
        let d = d0
        for (let step = 0; step < 64; step++) {
            let mixed = 0
            let wordIndex = 0
            if (step < 16) {
                mixed = (b & c) | (~b & d)
                wordIndex = step
            } else if (step < 32) {
                mixed = (d & b) | (~d & c)
                wordIndex = (5 * step + 1) % 16
            } else if (step < 48) {
                mixed = b ^ c ^ d
                wordIndex = (3 * step + 5) % 16
            } else {
                mixed = c ^ (b | ~d)
                wordIndex = (7 * step) % 16
            }
            const next = b + rotl((a + mixed + TABLE[step] + words[wordIndex]) | 0, SHIFT[step])
            a = d
            d = c
            c = b
            b = next | 0
        }
        a0 = (a0 + a) | 0
        b0 = (b0 + b) | 0
        c0 = (c0 + c) | 0
        d0 = (d0 + d) | 0
    }

    return hexWord(a0) + hexWord(b0) + hexWord(c0) + hexWord(d0)
}
