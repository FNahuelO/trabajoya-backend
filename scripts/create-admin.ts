import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createInterface } from "readline";

const prisma = new PrismaClient();

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function createAdmin() {
  console.log("=== Crear Usuario Administrador ===\n");

  rl.question("Email del administrador: ", async (email) => {
    rl.question("Contraseña: ", async (password) => {
      rl.question("Nombre completo: ", async (fullName) => {
        try {
          // Verificar si el usuario ya existe
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            // Actualizar usuario existente a admin
            const passwordHash = await bcrypt.hash(password, 10);
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                passwordHash,
                userType: "ADMIN",
                isVerified: true,
              },
            });
            console.log(`\n✅ Usuario ${email} actualizado como administrador`);
          } else {
            // Crear nuevo usuario admin
            const passwordHash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash,
                userType: "ADMIN",
                isVerified: true,
              },
            });

            // Crear perfil de postulante
            await prisma.postulanteProfile.create({
              data: {
                userId: user.id,
                fullName: fullName || "Administrador",
              },
            });

            console.log(
              `\n✅ Usuario administrador ${email} creado exitosamente`
            );
          }

          await prisma.$disconnect();
          rl.close();
          process.exit(0);
        } catch (error) {
          console.error("\n❌ Error:", error);
          await prisma.$disconnect();
          rl.close();
          process.exit(1);
        }
      });
    });
  });
}

createAdmin();
