import type { UserRole } from '@quokkaquest/shared';
import { withHouseholdContext } from '../../db/pool';

export interface HouseholdMember {
  id: string;
  display_name: string;
  role: UserRole;
}

/** Lists everyone in the household — used to populate task-assignment pickers etc. */
export async function listHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  return withHouseholdContext(householdId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, display_name, role FROM users ORDER BY role, display_name`,
    );
    return rows;
  });
}
