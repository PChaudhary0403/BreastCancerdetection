import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    const rootDir = "c:\\Users\\panka\\Desktop\\manifest-ZkhPvrLo5216730872708713142\\CBIS-DDSM";

    console.log("Finding DICOM files...");
    const command = `powershell "Get-ChildItem -Path '${rootDir}' -Filter *.dcm -Recurse | Select-Object -First 2 | Select-Object -ExpandProperty FullName"`;
    const output = execSync(command).toString().trim();
    const filePaths = output.split('\r\n').map(p => p.trim());

    if (filePaths.length < 2) throw new Error("Need 2 files");

    const storageRefs = filePaths.map(p => p.replace(/.*manifest-ZkhPvrLo5216730872708713142\\/, '').replace(/\\/g, '/'));

    const cases = await prisma.case.findMany();
    for (const c of cases) {
        console.log(`Updating case ${c.id}`);
        await prisma.imageMetadata.deleteMany({ where: { caseId: c.id } });
        for (let i = 0; i < storageRefs.length; i++) {
            await prisma.imageMetadata.create({
                data: {
                    caseId: c.id,
                    storageReference: storageRefs[i],
                    viewPosition: i === 0 ? 'CC' : 'MLO',
                    laterality: 'LEFT',
                    imageHashSha256: `hash-${Date.now()}-${i}`
                }
            });
        }
    }
    console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
