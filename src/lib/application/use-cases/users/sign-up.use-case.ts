import { IRoleRepository } from "../../repositories/role.repository.interface";
import { IUserRepository } from "../../repositories/user.repository.interface";
import { IAvatarService } from "../../services/avatar.service.interface";
import { IPasswordService } from "../../services/password.service.interface";
import { AuthenticationError } from "@/lib/entities/errors/common";
import { createId } from '@paralleldrive/cuid2';

export class SignUpUseCase {
    constructor(
        private userRepository: IUserRepository,
        private passwordService: IPasswordService,
        private roleRepository: IRoleRepository,
        private avatarService: IAvatarService,
    ) { }

    async execute(username: string, password: string): Promise<void> {

        // Independent lookups: run them together instead of back to back.
        const [findUser, userRole] = await Promise.all([
            this.userRepository.findByUsername(username),
            this.roleRepository.getRoleByName("user"),
        ]);

        if (findUser) {
            throw new AuthenticationError("Username sudah dipakai")
        }

        if (!userRole) {
            throw new AuthenticationError("Default role 'User' tidak ditemukan");
        }

        const hashPassword = await this.passwordService.hashPassword(password)

        const id = createId();
        const now = new Date();

        await this.userRepository.insert({
            id,
            username,
            name: username,
            password: hashPassword,
            avatar: this.avatarService.generateAvatarUrl(username),
            createdAt: now,
            updatedAt: now
        })

        await this.roleRepository.assignRoleToUser(id, userRole.id);
    }
}
