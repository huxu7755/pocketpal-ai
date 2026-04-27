import NativeKeepAwake from '../specs/NativeKeepAwake';

/**
 * Activates keep awake functionality to prevent the screen from going to sleep
 * @throws {Error} If the native module fails to activate
 */
export const activateKeepAwake = (): void => {
  try {
    NativeKeepAwake.activate();
  } catch (error) {
    throw error;
  }
};

/**
 * Deactivates keep awake functionality allowing the screen to go to sleep
 * @throws {Error} If the native module fails to deactivate
 */
export const deactivateKeepAwake = (): void => {
  try {
    NativeKeepAwake.deactivate();
  } catch (error) {
    throw error;
  }
};
