/**
 * withToast — client-side helper that wraps a Server Action call and
 * shows success / error toast notifications based on the result.
 *
 * Usage:
 *   const result = await withToast(
 *     () => deleteTaskAction(taskId, projectId),
 *     showToast,
 *     { successMsg: dict.common.toast.deleted },
 *   );
 *
 * The action must return { error?: string } or void.
 * If `successMsg` is undefined, no toast is shown on success (silent).
 */

import type { ToastVariant } from './toast-context';


type ActionResult = { error?: string } | void | undefined;


interface WithToastOptions {
  successMsg?: string;
  errorMsg?: string;
}


type ShowToast = (message: string, variant?: ToastVariant) => void;


export async function withToast<T extends ActionResult>(
  action: () => Promise<T>,
  showToast: ShowToast,
  options: WithToastOptions = {},
): Promise<T> {

  const result = await action();

  const error =
    result !== null &&
    result !== undefined &&
    typeof result === 'object' &&
    'error' in result
      ? (result as { error?: string }).error
      : undefined;

  if (error) {
    showToast(options.errorMsg ?? error, 'error');
  } else if (options.successMsg) {
    showToast(options.successMsg, 'success');
  }

  return result;
}
