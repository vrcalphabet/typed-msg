type Success = { success: true };
type SuccessData<T> = Success & { data: T };

type Failure = { success: false };
type FailureMessage<T> = Failure & { message: T };

export function success(): Success;
export function success<T>(data: T): SuccessData<T>;
export function success(data?: unknown) {
  if (data === undefined) {
    return { success: true };
  } else {
    return { success: true, data };
  }
}

export function failure(): Failure;
export function failure<T>(data: T): FailureMessage<T>;
export function failure(data?: unknown) {
  if (data === undefined) {
    return { success: false };
  } else {
    return { success: false, data };
  }
}
