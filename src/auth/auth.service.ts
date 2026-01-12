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
import { TermsService } from "../terms/terms.service";
import { TermsType } from "@prisma/client";

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private i18n: I18nService,
    private mailService: MailService,
    private termsService: TermsService
  ) {
    // Inicializar el cliente de Google con el Client ID principal
    // Se actualizará dinámicamente cuando AWS cargue los secretos
    this.initializeGoogleClient();
  }

  /**
   * Inicializa o actualiza el cliente de Google OAuth
   * Se llama en el constructor y se actualiza dinámicamente cuando se necesita
   */
  private initializeGoogleClient(): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    } else {
      // Crear un cliente temporal, se actualizará cuando AWS cargue los secretos
      this.googleClient = new OAuth2Client();
    }
  }

  /**
   * Intercambiar authorization code por tokens de Google
   * Esto se usa para el Authorization Code Flow que es más seguro
   */
  private async exchangeGoogleAuthCode(
    authCode: string,
    providedRedirectUri?: string
  ): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "Google OAuth credentials not configured on server"
      );
    }

    // Priorizar el redirectUri proporcionado por el cliente
    const possibleRedirectUris = providedRedirectUri
      ? [providedRedirectUri]
      : ["trabajoya://", "https://auth.expo.io/@fosorio/TrabajoYa"];

    let lastError: any;

    // Intentar con cada redirect URI
    for (const redirectUri of possibleRedirectUris) {
      try {
        console.log(
          `[Google Auth] Intentando intercambiar con redirectUri: ${redirectUri}`
        );

        const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(authCode);

        if (!tokens.id_token) {
          throw new Error("No se recibió id_token de Google");
        }

        console.log(
          `[Google Auth] ✅ Tokens obtenidos exitosamente con ${redirectUri}`
        );
        return tokens.id_token;
      } catch (error) {
        console.log(`[Google Auth] ❌ Falló con ${redirectUri}:`, error.message);
        lastError = error;
      }
    }

    // Si llegamos aquí, todos los redirect URIs fallaron
    console.error(
      "[Google Auth] Error intercambiando authorization code con todos los redirect URIs:",
      lastError
    );
    throw new BadRequestException(
      "Error al intercambiar el código de autorización con Google"
    );
  }

  /**
   * Obtiene el cliente de Google OAuth, inicializándolo si es necesario
   * Esto asegura que funcione correctamente después de que AWS cargue los secretos
   */
  private getGoogleClient(): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId) {
      // Recrear el cliente si el Client ID está disponible
      // Esto asegura que funcione después de que AWS cargue los secretos
      this.googleClient = new OAuth2Client(clientId);
    }
    return this.googleClient;
  }

  /**
   * Obtiene los Google Client IDs dinámicamente desde process.env
   * Esto permite que funcione tanto con variables de entorno locales como con AWS Secrets Manager
   */
  private getGoogleClientIds(): string[] {
    const clientIds = [
      process.env.GOOGLE_CLIENT_ID, // Web Client ID
      process.env.GOOGLE_IOS_CLIENT_ID, // iOS Client ID
      process.env.GOOGLE_ANDROID_CLIENT_ID, // Android Client ID
    ].filter(Boolean) as string[]; // Filtrar undefined/null y hacer type assertion

    // Log para debugging (solo en desarrollo o si hay cambios)
    if (process.env.NODE_ENV !== "production" || clientIds.length > 0) {
      console.log("[AuthService] Google Client IDs disponibles:", {
        web: !!process.env.GOOGLE_CLIENT_ID,
        ios: !!process.env.GOOGLE_IOS_CLIENT_ID,
        android: !!process.env.GOOGLE_ANDROID_CLIENT_ID,
        total: clientIds.length,
      });
    }

    return clientIds;
  }

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
    // Si viene googleAuthCode, intercambiarlo por idToken
    if (dto.googleAuthCode) {
      console.log("[Register] Procesando Google authorization code...");
      dto.idToken = await this.exchangeGoogleAuthCode(
        dto.googleAuthCode,
        dto.googleRedirectUri
      );
    }

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

    // Validar términos y condiciones
    if (!dto.aceptaTerminos) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.termsNotAccepted",
          "Debes aceptar los términos y condiciones"
        )
      );
    }

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

    // Aceptar términos y condiciones
    try {
      const activeTerms = await this.termsService.getActiveTerms(
        undefined,
        TermsType.POSTULANTE
      );
      await this.termsService.acceptTerms(
        user.id,
        TermsType.POSTULANTE,
        activeTerms.version
      );
    } catch (error) {
      console.error("Error aceptando términos:", error);
      // No fallar el registro si hay error aceptando términos, pero loguear
    }

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
      // Validar con múltiples Client IDs (Web, iOS, Android)
      // Obtener Client IDs dinámicamente (desde AWS Secrets Manager o variables de entorno)
      const clientIds = this.getGoogleClientIds();
      if (clientIds.length === 0) {
        throw new UnauthorizedException(
          await this.getTranslation(
            "auth.googleNotConfigured",
            "Google OAuth no está configurado correctamente"
          )
        );
      }

      const ticket = await this.getGoogleClient().verifyIdToken({
        idToken: dto.idToken,
        audience: clientIds, // Acepta cualquier Client ID configurado
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

        // Aceptar términos y condiciones automáticamente para registro con Google
        try {
          const activeTerms = await this.termsService.getActiveTerms(
            undefined,
            TermsType.POSTULANTE
          );
          await this.termsService.acceptTerms(
            user.id,
            TermsType.POSTULANTE,
            activeTerms.version
          );
        } catch (error) {
          console.error("Error aceptando términos:", error);
          // No fallar el registro si hay error aceptando términos, pero loguear
        }
      }

      const tokens = await this.issueTokens(user.id, user.userType);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          tipo: user.userType.toLowerCase() as "postulante" | "empresa",
          verificado: user.isVerified,
        },
      };
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
        // Primero decodificar el token sin verificar para obtener el audience
        const decodedToken = jwt.decode(dto.identityToken) as any;
        console.log("[registerApple] Token decodificado:", {
          iss: decodedToken?.iss,
          aud: decodedToken?.aud,
          sub: decodedToken?.sub,
          email: decodedToken?.email,
          email_verified: decodedToken?.email_verified,
          exp: decodedToken?.exp,
          APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
        });

        // Lista de audiences válidos (iOS Bundle ID, Service ID, Web Client ID)
        // Esto permite que funcione tanto para apps móviles como web
        const validAudiences = [
          process.env.APPLE_CLIENT_ID, // Configurado en AWS (puede ser web o service ID)
          decodedToken?.aud, // El audience del token (Bundle ID de iOS o Service ID)
          "com.trabajoya.app", // Bundle ID de iOS según app.json
          "com.trabajoya.app.service", // Service ID según app.json
          "com.trabajoya.web", // Web Client ID según AWS Secrets Manager
        ].filter(Boolean); // Eliminar valores undefined/null

        // Remover duplicados
        const uniqueAudiences = [...new Set(validAudiences)];
        console.log(
          "[registerApple] Audiences válidos a intentar:",
          uniqueAudiences
        );

        // Intentar verificar con cada audience hasta que uno funcione
        let lastError: any = null;
        for (const audience of uniqueAudiences) {
          try {
            console.log(
              `[registerApple] Intentando verificar con audience: ${audience}`
            );
            appleData = await appleSignin.verifyIdToken(dto.identityToken, {
              audience: audience as string,
              ignoreExpiration: false,
            });
            console.log(
              `[registerApple] ✅ Token verificado exitosamente con audience: ${audience}`
            );
            break; // Si funciona, salir del loop
          } catch (verifyError: any) {
            console.log(
              `[registerApple] ❌ Error verificando con ${audience}:`,
              verifyError.message
            );
            lastError = verifyError;
            // Continuar con el siguiente audience
          }
        }

        // Si ningún audience funcionó, lanzar error
        if (!appleData) {
          console.error(
            "[registerApple] ❌ No se pudo verificar el token con ningún audience válido"
          );
          throw (
            lastError ||
            new Error(
              "Token de Apple inválido: no coincide con ningún audience configurado"
            )
          );
        }
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

      console.log("[registerApple] Datos de Apple obtenidos:", {
        sub: appleData?.sub,
        email: appleData?.email,
        emailFromDto: dto.email,
        appleUserIdFromDto: dto.appleUserId,
      });

      // El email puede venir en el token o en dto.email
      // Si viene en el token, usar ese porque es más confiable
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
            fullName: dto.fullName || "",
          },
        });

        // Aceptar términos y condiciones automáticamente para registro con Apple
        try {
          const activeTerms = await this.termsService.getActiveTerms(
            undefined,
            TermsType.POSTULANTE
          );
          await this.termsService.acceptTerms(
            user.id,
            TermsType.POSTULANTE,
            activeTerms.version
          );
        } catch (error) {
          console.error("Error aceptando términos:", error);
          // No fallar el registro si hay error aceptando términos, pero loguear
        }
      }

      const tokens = await this.issueTokens(user.id, user.userType);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          tipo: user.userType.toLowerCase() as "postulante" | "empresa",
          verificado: user.isVerified,
        },
      };
    } catch (error) {
      // Si es un error de validación conocido, lanzarlo directamente
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log detallado del error
      console.error("[registerApple] Error verificando token de Apple:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        identityToken: dto.identityToken ? "presente" : "ausente",
        authorizationCode: dto.authorizationCode ? "presente" : "ausente",
        appleUserId: dto.appleUserId,
        email: dto.email,
        APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID
          ? "configurado"
          : "NO CONFIGURADO",
      });

      // Proporcionar un mensaje de error más específico
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let translatedMessage = await this.getTranslation(
        "auth.invalidAppleToken",
        "Token de Apple inválido"
      );

      // Si el error menciona audience o client ID, agregar información útil
      if (errorMessage.includes("audience") || errorMessage.includes("aud")) {
        translatedMessage += `. Verifica que APPLE_CLIENT_ID coincida con el Bundle ID de tu app iOS.`;
      } else if (
        errorMessage.includes("expired") ||
        errorMessage.includes("exp")
      ) {
        translatedMessage += ". El token ha expirado. Intenta nuevamente.";
      }

      throw new UnauthorizedException(translatedMessage);
    }
  }

  async loginGoogle(dto: { idToken: string }) {
    if (!dto.idToken) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.googleTokenRequired",
          "Token de Google requerido"
        )
      );
    }

    try {
      // Validar con múltiples Client IDs (Web, iOS, Android)
      // Obtener Client IDs dinámicamente (desde AWS Secrets Manager o variables de entorno)
      const clientIds = this.getGoogleClientIds();
      if (clientIds.length === 0) {
        throw new UnauthorizedException(
          await this.getTranslation(
            "auth.googleNotConfigured",
            "Google OAuth no está configurado correctamente"
          )
        );
      }

      const ticket = await this.getGoogleClient().verifyIdToken({
        idToken: dto.idToken,
        audience: clientIds, // Acepta cualquier Client ID configurado
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

      // Buscar usuario por email o googleId
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: payload.email }, { googleId: payload.sub }],
        },
      });

      // Si no existe el usuario, lanzar error
      if (!user) {
        throw new UnauthorizedException(
          await this.getTranslation(
            "auth.userNotFound",
            "Usuario no encontrado. Por favor regístrate primero."
          )
        );
      }

      // Verificar que el usuario tenga googleId asociado o actualizarlo
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub },
        });
      }

      const tokens = await this.issueTokens(user.id, user.userType);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          tipo: user.userType.toLowerCase() as "postulante" | "empresa",
          verificado: user.isVerified,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error("Error verificando token de Google:", error);
      throw new UnauthorizedException(
        await this.getTranslation(
          "auth.invalidGoogleToken",
          "Token de Google inválido"
        )
      );
    }
  }

  async loginApple(dto: {
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
        // Primero decodificar el token sin verificar para obtener el audience
        const decodedToken = jwt.decode(dto.identityToken) as any;

        // Lista de audiences válidos (iOS Bundle ID, Service ID, Web Client ID)
        // Esto permite que funcione tanto para apps móviles como web
        const validAudiences = [
          process.env.APPLE_CLIENT_ID, // Configurado en AWS (puede ser web o service ID)
          decodedToken?.aud, // El audience del token (Bundle ID de iOS o Service ID)
          process.env.APPLE_BUNDLE_ID, // Bundle ID de iOS según app.json
        ].filter(Boolean); // Eliminar valores undefined/null

        // Remover duplicados
        const uniqueAudiences = [...new Set(validAudiences)];

        // Intentar verificar con cada audience hasta que uno funcione
        let lastError: any = null;
        for (const audience of uniqueAudiences) {
          try {
            appleData = await appleSignin.verifyIdToken(dto.identityToken, {
              audience: audience as string,
              ignoreExpiration: false,
            });
            break; // Si funciona, salir del loop
          } catch (verifyError: any) {
            lastError = verifyError;
            // Continuar con el siguiente audience
          }
        }

        // Si ningún audience funcionó, lanzar error
        if (!appleData) {
          throw (
            lastError ||
            new Error(
              "Token de Apple inválido: no coincide con ningún audience configurado"
            )
          );
        }
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

      // El email puede venir en el token o en dto.email
      // Si viene en el token, usar ese porque es más confiable
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

      // Buscar usuario por appleId o email
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ appleId: appleUserId }, ...(email ? [{ email }] : [])],
        },
      });

      // Si no existe el usuario, lanzar error
      if (!user) {
        throw new UnauthorizedException(
          await this.getTranslation(
            "auth.userNotFound",
            "Usuario no encontrado. Por favor regístrate primero."
          )
        );
      }

      // Verificar que el usuario tenga appleId asociado o actualizarlo
      if (!user.appleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { appleId: appleUserId },
        });
      }

      const tokens = await this.issueTokens(user.id, user.userType);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          tipo: user.userType.toLowerCase() as "postulante" | "empresa",
          verificado: user.isVerified,
        },
      };
    } catch (error) {
      // Si es un error de validación conocido, lanzarlo directamente
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log detallado del error
      console.error("[loginApple] Error verificando token de Apple:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        identityToken: dto.identityToken ? "presente" : "ausente",
        authorizationCode: dto.authorizationCode ? "presente" : "ausente",
        appleUserId: dto.appleUserId,
        email: dto.email,
        APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID
          ? "configurado"
          : "NO CONFIGURADO",
      });

      // Proporcionar un mensaje de error más específico
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let translatedMessage = await this.getTranslation(
        "auth.invalidAppleToken",
        "Token de Apple inválido"
      );

      // Si el error menciona audience o client ID, agregar información útil
      if (errorMessage.includes("audience") || errorMessage.includes("aud")) {
        translatedMessage += `. Verifica que APPLE_CLIENT_ID coincida con el Bundle ID de tu app iOS.`;
      } else if (
        errorMessage.includes("expired") ||
        errorMessage.includes("exp")
      ) {
        translatedMessage += ". El token ha expirado. Intenta nuevamente.";
      }

      throw new UnauthorizedException(translatedMessage);
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
    // Si viene googleAuthCode, intercambiarlo por idToken
    if (dto.googleAuthCode) {
      console.log("[Login] Procesando Google authorization code...");
      dto.idToken = await this.exchangeGoogleAuthCode(
        dto.googleAuthCode,
        dto.googleRedirectUri
      );
    }

    // Login con Google
    if (dto.idToken) {
      return this.loginGoogle({ idToken: dto.idToken });
    }

    // Login con Apple
    if (dto.identityToken || dto.authorizationCode || dto.appleUserId) {
      return this.loginApple({
        identityToken: dto.identityToken,
        authorizationCode: dto.authorizationCode,
        email: dto.email,
        fullName: dto.fullName,
        appleUserId: dto.appleUserId,
      });
    }

    // Login con email/password
    if (!dto.email || !dto.password) {
      throw new BadRequestException(
        await this.getTranslation(
          "auth.invalidCredentials",
          "Credenciales inválidas"
        )
      );
    }

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
    // Obtener el usuario para incluir userType en el token
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, userType: true, email: true },
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        role,
        userType: user?.userType,
        email: user?.email,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      }
    );

    const refreshToken = crypto.randomUUID();
    // JWT_REFRESH_EXPIRES_IN puede ser "7d", "30d", etc. o un número en segundos
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    // Convertir a milisegundos si es un número, o parsear formato como "7d"
    let refreshExpiresInMs = 7 * 24 * 60 * 60 * 1000; // default 7 días
    if (refreshExpiresIn.match(/^\d+$/)) {
      refreshExpiresInMs = Number(refreshExpiresIn) * 1000;
    } else if (refreshExpiresIn.endsWith("d")) {
      const days = Number(refreshExpiresIn.slice(0, -1));
      refreshExpiresInMs = days * 24 * 60 * 60 * 1000;
    } else if (refreshExpiresIn.endsWith("h")) {
      const hours = Number(refreshExpiresIn.slice(0, -1));
      refreshExpiresInMs = hours * 60 * 60 * 1000;
    }
    const expiresAt = new Date(Date.now() + refreshExpiresInMs);

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

    // Enviar email con el token
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: await this.getTranslation(
        "auth.verificationEmailSent",
        "Email de verificación enviado"
      ),
      ...(process.env.NODE_ENV === "development" && { verificationToken }),
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Por seguridad, no revelar si el email existe o no
    if (!user) {
      return {
        message: await this.getTranslation(
          "auth.verificationEmailSent",
          "Si el email existe y no está verificado, se enviará un email de verificación"
        ),
      };
    }

    // Si el email ya está verificado, no hacer nada (por seguridad)
    if (user.isVerified) {
      return {
        message: await this.getTranslation(
          "auth.verificationEmailSent",
          "Si el email existe y no está verificado, se enviará un email de verificación"
        ),
      };
    }

    // Si no tiene token de verificación, generar uno nuevo
    let verificationToken = user.verificationToken;
    if (!verificationToken) {
      verificationToken = crypto.randomUUID();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationToken },
      });
    }

    // Enviar email con el token
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: await this.getTranslation(
        "auth.verificationEmailSent",
        "Si el email existe y no está verificado, se enviará un email de verificación"
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
    const address = `${dto.calle} ${dto.numero}, ${
      dto.localidad || dto.provincia
    }, ${dto.provincia}, ${dto.codigoPostal}`;
    const phone = dto.telefono ? dto.telefono.trim() : undefined;

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
        ...(dto.phoneCountryCode && {
          phoneCountryCode: dto.phoneCountryCode.trim(),
        }),
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
        localidad: dto.localidad || undefined,
        ciudad: dto.ciudad || dto.localidad || undefined,
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
