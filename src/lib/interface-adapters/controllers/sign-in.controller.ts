import { SignInUseCase } from "@/lib/application/use-cases/users/sign-in.use-case";
import { InputParsedError } from "@/lib/entities/errors/common";
import { SignInUserDTO } from "@/lib/entities/models/user.model";
import { SessionRepository } from "@/lib/infrastructure/repositories/session.repository";
import { UserRepository } from "@/lib/infrastructure/repositories/user.repository";
import { AuthenticationService, AuthMetadata } from "@/lib/infrastructure/services/authentication.service";
import { PasswordService } from "@/lib/infrastructure/services/password.service";
import { DrizzleActivityLogRepository } from "@/lib/infrastructure/repositories/activity-log.repository";
import { z } from "zod";

import { db } from "@/lib/db";

const userRepository = new UserRepository(db);
const sessionRepository = new SessionRepository(db);
const activityLogRepository = new DrizzleActivityLogRepository();

const authenticationService = new AuthenticationService(
    sessionRepository,
    userRepository,
    activityLogRepository
);
const passwordService = new PasswordService();

const signInUseCase = new SignInUseCase(
    userRepository,
    authenticationService,
    passwordService,
)

const formSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export const signInController = async (userCredential: SignInUserDTO, context?: { ip?: string; userAgent?: string; metadata?: AuthMetadata }) => {
    const parsedUserCredential = formSchema.safeParse(userCredential);

    if (!parsedUserCredential.success) {
        const errorField = {
            ...parsedUserCredential.error?.flatten().fieldErrors,
        }
        throw new InputParsedError("Invalid input: ", errorField)
    }

    return await signInUseCase.execute(
        parsedUserCredential.data.username,
        parsedUserCredential.data.password,
        context
    )
}