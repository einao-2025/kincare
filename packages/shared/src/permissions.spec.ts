import { permissionsForRole, Permissions, ROLE_PERMISSIONS, SCOPE_TO_PERMISSIONS } from './permissions';
import { Roles } from './roles';

describe('permission matrix', () => {
  it('maps every defined role', () => {
    for (const r of Object.values(Roles)) {
      expect(ROLE_PERMISSIONS[r]).toBeDefined();
    }
  });

  it('grants patient self-read but not cross-patient read', () => {
    const p = permissionsForRole(Roles.PATIENT);
    expect(p).toContain(Permissions.PATIENT_READ_OWN);
    expect(p).not.toContain(Permissions.PATIENT_READ_ANY);
  });

  it('grants doctor cross-patient read + prescribe', () => {
    const p = permissionsForRole(Roles.DOCTOR);
    expect(p).toContain(Permissions.PATIENT_READ_ANY);
    expect(p).toContain(Permissions.RX_PRESCRIBE);
  });

  it('only super admin gets system admin', () => {
    for (const r of Object.values(Roles)) {
      const has = permissionsForRole(r).includes(Permissions.ADMIN_SYSTEM);
      expect(has).toBe(r === Roles.SUPER_ADMIN);
    }
  });

  it('every family scope is registered', () => {
    const scopes = ['VIEW_DEMOGRAPHICS','VIEW_MEDICAL_HISTORY','VIEW_PRESCRIPTIONS',
                    'REQUEST_REFILL','AUTHORIZE_PICKUP','VIEW_TEST_RESULTS','VIEW_IMAGING',
                    'RECEIVE_PROGRESS_UPDATES','EMERGENCY_ACCESS'];
    for (const s of scopes) {
      expect(SCOPE_TO_PERMISSIONS[s]).toBeDefined();
    }
  });
});
