/**
 * What flipping a permission switch should do. Pure, unit-tested.
 *
 * An app can ask for a permission but can't take one back, and can't ask again
 * once the phone has stopped showing the prompt. Both of those cases can only
 * be handled in the phone's Settings.
 */
export type PermissionStatus = { granted: boolean; canAskAgain: boolean };

export function toggleAction(turningOn: boolean, current: PermissionStatus): 'ask' | 'settings' {
  return turningOn && !current.granted && current.canAskAgain ? 'ask' : 'settings';
}
