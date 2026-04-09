import { BadRequestException, type ValidationPipeOptions } from '@nestjs/common';
import type { ValidationError } from 'class-validator';


interface ValidationIssue {
  field: string;
  errors: string[];
}


function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationIssue[] {

  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = error.constraints ? Object.values(error.constraints) : [];
    const nestedErrors = error.children?.length
      ? flattenValidationErrors(error.children, field)
      : [];

    if (ownErrors.length === 0) {
      return nestedErrors;
    }

    return [{ field, errors: ownErrors }, ...nestedErrors];
  });
}


export function createValidationPipeOptions(): ValidationPipeOptions {

  return {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) => new BadRequestException({
      error: 'Bad Request',
      message: 'Validation failed',
      details: flattenValidationErrors(errors),
    }),
  };
}
