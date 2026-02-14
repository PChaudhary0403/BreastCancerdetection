import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    const images = await prisma.imageMetadata.findMany({
        take: 10,
    });

    console.log(`Checking ${images.length} images...`);
    for (const img of images) {
        const storagePath = img.storageReference;
        // Check in root relative to app
        const rootPath = path.join(process.cwd(), "..", storagePath);
        const exists = fs.existsSync(rootPath);

        console.log(`- ${storagePath} -> ${exists ? 'EXISTS' : 'MISSING'}`);
        if (!exists) {
            // Try searching for the leaf directory
            const parts = storagePath.split('/');
            const leafDir = parts[parts.length - 3] || parts[0];
            console.log(`  Searching for dir: ${leafDir}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
