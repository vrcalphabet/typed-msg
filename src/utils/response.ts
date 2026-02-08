import { FailureMessageResponse, SuccessMessageResponse } from '../main';

export function success<T extends void>(): SuccessMessageResponse<void>;
export function success<T>(data: T): SuccessMessageResponse<T>;
export function success<T>(data?: T) {
  if (data === undefined) {
    return { success: true };
  } else {
    return { success: true, data };
  }
}

export function failure<T extends void>(): FailureMessageResponse<void>;
export function failure<T>(data: T): FailureMessageResponse<T>;
export function failure<T>(data?: T) {
  if (data === undefined) {
    return { success: false };
  } else {
    return { success: false, data };
  }
}
