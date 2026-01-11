
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');


export async function parseFile(fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
        try {
            const data = await pdf(fileBuffer);
            return data.text;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error('Failed to parse PDF file');
        }
    } else if (mimeType === 'text/plain') {
        return fileBuffer.toString('utf-8');
    } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
}
