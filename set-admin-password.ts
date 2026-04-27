import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'pankajchaudhary0403@gmail.com'
    const password = 'AdminPassword123!'
    
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
        console.error("User not found!")
        return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.update({
        where: { email },
        data: { passwordHash }
    })
    console.log(`Success! Fixed the password for ${email}.`)
    console.log(`You can now login using:`)
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
