import { AuthenticationService, AuthMetadata } from "@/lib/infrastructure/services/authentication.service";
import { IUserRepository } from "../../repositories/user.repository.interface";
import { IPasswordService } from "../../services/password.service.interface";
import { AuthenticationError } from "@/lib/entities/errors/common";

// One message for both "no such user" and "wrong password", so the form does
// not reveal which usernames exist.
const INVALID_CREDENTIALS = "Username atau password salah";

export class SignInUseCase {
    constructor(
        private userRepository: IUserRepository,
        private authenticationService: AuthenticationService,
        private passwordService: IPasswordService,
    ) { }

    async execute(username: string, password: string, context?: { ip?: string; userAgent?: string; metadata?: AuthMetadata }): Promise<string> {

        const findUser = await this.userRepository.findByUsername(username)

        if (!findUser) {
            throw new AuthenticationError(INVALID_CREDENTIALS)
        }

        const validatePassword = await this.passwordService.comparePassword(
            password,
            findUser.password
        )

        if (!validatePassword) {
            await this.authenticationService.logEvent({
                userId: findUser.id,
                category: "auth",
                action: "login_failed",
                metadata: async () => ({
                    ...(typeof context?.metadata === "function"
                        ? await context.metadata()
                        : context?.metadata),
                    reason: "invalid_password",
                }),
                ip: context?.ip,
                userAgent: context?.userAgent,
            });
            throw new AuthenticationError(INVALID_CREDENTIALS)
        }

        const token = await this.authenticationService.generateSessionToken();
        await this.authenticationService.createSession(token, findUser.id)

        // Log successful login
        await this.authenticationService.logEvent({
            userId: findUser.id,
            category: "auth",
            action: "login",
            metadata: context?.metadata,
            ip: context?.ip,
            userAgent: context?.userAgent,
        });

        return token;
    }
}