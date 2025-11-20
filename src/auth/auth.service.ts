import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import * as appleSignin from "apple-signin-auth";
import * as jwt from "jsonwebtoken";
import { I18nService } from "nestjs-i18n";
import { MailService } from "../mail/mail.service";
import { RegisterEmpresaDto } from "./dto/register-empresa.dto";

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private i18n: I18nService,
    private mailService: MailService
  ) {}

  private async getTranslation(key: string, fallback: string): Promise<string> {
    try {
      return await this.i18n.translate(key);
    } catch (error) {
      console.warn(
        `Translation failed for key: ${key}, using fallback: ${fallback}`
      );
      return fallback;
    }
  }

  async register(dto: any) {
    if (dto.idToken) {
      // Registro con Google
      return this.registerGoogle({ idToken: dto.idToken });
    } else if (dto.identityToken || dto.authorizationCode || dto.appleUserId) {
      // Registro con Apple
      return this.registerApple({
        identityToken: dto.identityToken,
        authorizationCode: dto.authorizationCode,
        email: dto.email,
        fullName: dto.fullName,
        appleUserId: dto.appleUserId,
      });
    } else if (dto.email && dto.password) {
      // Registro con email/password
      return this.registerEmail(dto);
    } else {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.invalidRegistrationData",
          "Datos de registro inválidos"
        )
      );
    }
  }

  async registerEmail(dto: any) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists)
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.emailAlreadyRegistered",
          "El email ya está registrado"
        )
      );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = crypto.randomUUID();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        userType: "POSTULANTE",
        isVerified: false,
        verificationToken,
      },
    });

    await this.prisma.postulanteProfile.create({
      data: { userId: user.id, fullName: dto.fullName ?? "Sin nombre" },
    });

    // Enviar email de verificación
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: await this.getTranslation(
        "auth.registrationSuccess",
        "Registro exitoso. Por favor verifica tu email para activar tu cuenta"
      ),
      ...(process.env.NODE_ENV === "development" && { verificationToken }),
    };
  }

  async registerGoogle(dto: { idToken: string }) {
    if (!dto.idToken) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.googleTokenRequired",
          "Token de Google requerido"
        )
      );
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        throw new UnauthorizedException(
          await this.getTranslation(
            "auth.invalidGoogleToken",
            "Token de Google inválido"
          )
        );
      }

      let user = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: payload.email,
            passwordHash: "",
            userType: "POSTULANTE",
            isVerified: true,
            googleId: payload.sub,
          },
        });

        await this.prisma.postulanteProfile.create({
          data: {
            userId: user.id,
            fullName: payload.name ?? "Sin nombre",
            profilePicture: payload.picture,
          },
        });
      }

      return this.issueTokens(user.id, user.userType);
    } catch (error) {
      console.error("Error verificando token de Google:", error);
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidGoogleToken",
          "Token de Google inválido"
        )
      );
    }
  }

  async registerApple(dto: {
    identityToken?: string;
    authorizationCode?: string;
    email?: string;
    fullName?: string;
    appleUserId?: string;
  }) {
    try {
      let appleData: any;

      // Opción 1: Verificar el identityToken (JWT)
      if (dto.identityToken) {
        appleData = await appleSignin.verifyIdToken(dto.identityToken, {
          audience: process.env.APPLE_CLIENT_ID, // Tu bundle ID o service ID
          ignoreExpiration: false,
        });
      }
      // Opción 2: Usar el authorization code para obtener tokens
      else if (dto.authorizationCode) {
        const tokenResponse = await appleSignin.getAuthorizationToken(
          dto.authorizationCode,
          {
            clientID: process.env.APPLE_CLIENT_ID ?? "",
            clientSecret: await this.generateAppleClientSecret(),
            redirectUri: process.env.APPLE_REDIRECT_URI ?? "",
          }
        );

        appleData = await appleSignin.verifyIdToken(tokenResponse.id_token, {
          audience: process.env.APPLE_CLIENT_ID,
        });
      } else {
        throw new BadRequestException(
          await this.getTranslation(
            "auth.appleTokenOrCodeRequired",
            "identityToken o authorizationCode requerido"
          )
        );
      }

      const email = appleData.email || dto.email;
      const appleUserId = appleData.sub || dto.appleUserId;

      if (!appleUserId) {
        throw new BadRequestException(
          await this.getTranslation(
            "auth.appleUserIdRequired",
            "Apple User ID requerido"
          )
        );
      }

      let user = await this.prisma.user.findFirst({
        where: { appleId: appleUserId },
      });

      if (!user && email) {
        user = await this.prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { appleId: appleUserId },
          });
        }
      }

      if (!user) {
        if (!email) {
          throw new BadRequestException(
            await this.getTranslation(
              "auth.emailRequiredFirstLogin",
              "Email requerido en el primer inicio de sesión"
            )
          );
        }

        user = await this.prisma.user.create({
          data: {
            email,
            passwordHash: "",
            userType: "POSTULANTE",
            isVerified: true,
            appleId: appleUserId,
          },
        });

        await this.prisma.postulanteProfile.create({
          data: {
            userId: user.id,
            fullName: dto.fullName || "Sin nombre",
          },
        });
      }

      return this.issueTokens(user.id, user.userType);
    } catch (error) {
      console.error("Error verificando token de Apple:", error);
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidAppleToken",
          "Token de Apple inválido"
        )
      );
    }
  }

  private async generateAppleClientSecret(): Promise<string> {
    const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!privateKey) {
      throw new Error("APPLE_PRIVATE_KEY no configurada");
    }

    const token = jwt.sign(
      {
        iss: process.env.APPLE_TEAM_ID, // Tu Team ID
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 6 meses
        aud: "https://appleid.apple.com",
        sub: process.env.APPLE_CLIENT_ID, // Tu bundle ID o service ID
      },
      privateKey,
      {
        algorithm: "ES256",
        keyid: process.env.APPLE_KEY_ID, // Tu Key ID
      }
    );

    return token;
  }

  async login(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user)
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidCredentials",
          "Credenciales inválidas"
        )
      );

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok)
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidCredentials",
          "Credenciales inválidas"
        )
      );

    // Verificar que el usuario esté verificado
    if (!user.isVerified) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.emailNotVerified",
          "Por favor verifica tu email antes de iniciar sesión"
        )
      );
    }

    const tokens = await this.issueTokens(user.id, user.userType);

    // Devolver tokens junto con información básica del usuario
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        tipo: user.userType.toLowerCase() as "postulante" | "empresa",
        verificado: user.isVerified,
      },
    };
  }

  private async issueTokens(userId: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: Number(process.env.JWT_ACCESS_TTL || 900),
      }
    );

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 1000 * Number(process.env.JWT_REFRESH_TTL || 2592000)
    );

    await this.prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string) {
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!token || token.revokedAt) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidRefreshToken",
          "Token de actualización inválido"
        )
      );
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.expiredRefreshToken",
          "Token de actualización expirado"
        )
      );
    }

    // Revocar el token anterior
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(token.userId, token.user.userType);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revocar todos los tokens del usuario
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return {
      message: await this.getTranslation(
        "auth.logoutSuccess",
        "Sesión cerrada exitosamente"
      ),
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Por seguridad, no revelar si el email existe o no
      return {
        message: await this.getTranslation(
          "auth.resetEmailSent",
          "Si el email existe, se enviará un enlace de recuperación"
        ),
      };
    }

    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Enviar email de recuperación
    await this.mailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: await this.getTranslation(
        "auth.resetEmailSent",
        "Si el email existe, se enviará un enlace de recuperación"
      ),
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidOrExpiredToken",
          "Token inválido o expirado"
        )
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      message: await this.getTranslation(
        "auth.passwordResetSuccess",
        "Contraseña restablecida exitosamente"
      ),
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidVerificationToken",
          "Token de verificación inválido"
        )
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return {
      message: await this.getTranslation(
        "auth.emailVerified",
        "Email verificado exitosamente"
      ),
    };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(
        await this.getTranslation("users.userNotFound", "Usuario no encontrado")
      );
    }

    if (user.isVerified) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.alreadyVerified",
          "El email ya está verificado"
        )
      );
    }

    // Si no tiene token de verificación, generar uno nuevo
    let verificationToken = user.verificationToken;
    if (!verificationToken) {
      verificationToken = crypto.randomUUID();
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationToken },
      });
    }

    // TODO: Enviar email con el token
    console.log(`Verification token for ${user.email}: ${verificationToken}`);

    return {
      message: await this.getTranslation(
        "auth.verificationEmailSent",
        "Email de verificación enviado"
      ),
      ...(process.env.NODE_ENV === "development" && { verificationToken }),
    };
  }

  async registerEmpresa(dto: RegisterEmpresaDto) {
    // Verificar si el email ya existe
    console.log(dto);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.emailAlreadyRegistered",
          "El email ya está registrado"
        )
      );
    }

    // Verificar si el CUIT ya existe
    const existingEmpresa = await this.prisma.empresaProfile.findUnique({
      where: { cuit: dto.documento },
    });

    if (existingEmpresa) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.cuitAlreadyRegistered",
          "El CUIT ya está registrado"
        )
      );
    }

    // Validar que las contraseñas coincidan
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.passwordsDontMatch",
          "Las contraseñas no coinciden"
        )
      );
    }

    // Validar términos y condiciones
    if (!dto.aceptaTerminos) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.termsNotAccepted",
          "Debes aceptar los términos y condiciones"
        )
      );
    }

    // Crear hash de la contraseña
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = crypto.randomUUID();

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        userType: "EMPRESA",
        isVerified: false,
        verificationToken,
      },
    });

    // Construir dirección completa
    const address = `${dto.calle} ${dto.numero}, ${dto.provincia}, ${dto.codigoPostal}`;
    const phone = `${dto.phoneCountryCode}${dto.telefono}`;

    // Crear perfil de empresa con todos los datos
    await this.prisma.empresaProfile.create({
      data: {
        userId: user.id,
        companyName: dto.companyName,
        razonSocial: dto.razonSocial,
        cuit: dto.documento,
        documento: dto.documento,
        email: dto.email,
        ...(phone && { phone }),
        industria: dto.industria,
        sector: dto.industria,
        cantidadEmpleados: dto.cantidadEmpleados,
        tamano: dto.cantidadEmpleados,
        condicionFiscal: dto.condicionFiscal,
        contribuyenteIngresosBrutos: dto.contribuyenteIngresosBrutos,
        // Dirección
        calle: dto.calle,
        numero: dto.numero,
        codigoPostal: dto.codigoPostal,
        provincia: dto.provincia,
        ciudad: dto.provincia, // Por defecto, puede actualizarse después
        // Contacto
        nombreContacto: dto.nombre,
        apellidoContacto: dto.apellido,
        // Encabezados y beneficios (inicializados como arrays vacíos)
        encabezadosAvisos: [],
        beneficiosEmpresa: [],
      } as any,
    });

    // Enviar email de verificación
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    // Generar tokens
    const tokens = await this.issueTokens(user.id, user.userType);

    return {
      user: {
        id: user.id,
        email: user.email,
        tipo: user.userType.toLowerCase(),
        verificado: user.isVerified,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
