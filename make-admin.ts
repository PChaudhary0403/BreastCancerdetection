import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const email = 'pankajchaudhary0403@gmail.com'
    
    // Check if user exists
    let user = await prisma.user.findUnique({
        where: { email }
    })
    
    if (user) {
        // Update to admin
        user = await prisma.user.update({
            where: { email },
            data: { 
                role: UserRole.ADMIN,
                emailVerified: new Date(), // verify email just in case
                admin: {
                    upsert: {
                        create: { permissions: { full: true } },
                        update: { permissions: { full: true } }
                    }
                }
            }
        })
        console.log(`Updated existing user ${email} to ADMIN.`)
    } else {
        // Create as admin
        user = await prisma.user.create({
            data: {
                email,
                name: 'Pankaj Chaudhary',
                role: UserRole.ADMIN,
                emailVerified: new Date(),
                admin: {
                    create: {
                        permissions: { full: true }
                    }
                }
            }
        })
        console.log(`Created new user ${email} as ADMIN.`)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
