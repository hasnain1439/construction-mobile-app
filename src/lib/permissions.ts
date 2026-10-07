export type Role = 'THEKEDAR' | 'PM' | 'MUNSHI';

/** What the signed-in person may do in the app (the server checks again). */
export const can = {
  setWorkerRate: (role: Role) => role !== 'MUNSHI',
  payWages: (_role: Role) => true,
  seeSubcontractRates: (role: Role) => role !== 'MUNSHI',
  requestTopup: (role: Role) => role !== 'THEKEDAR',
};
