import { IRoleService } from "@/lib/application/services/role.service.interface";
import { UserRepository } from "@/lib/infrastructure/repositories/user.repository";
import { SessionDTO } from "@/lib/entities/models/session.model";

export class RoleService implements IRoleService {
  constructor(
    private userRepository: UserRepository,
) {}

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const user = await this.userRepository.findByIdWithRoles(userId);
    if (!user) return false;
    return user.roles.some((r) => r.name === roleName);
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const user = await this.userRepository.findByIdWithRoles(userId);
    return user?.roles.map((r) => r.name) ?? [];
  }

  async getUserWithRolesFromSession(session: SessionDTO | null) {
    if (!session) return null;
  
    const username = session.user?.username;
    if (!username) return null;

    const user = await this.userRepository.findByUsernameWithRoles(username);
    return user;
  }

  async isUserProtected(userId: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes("admin") || roles.includes("super_admin"); 
  }
  
}
