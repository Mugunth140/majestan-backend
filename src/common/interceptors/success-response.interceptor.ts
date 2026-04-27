import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

type SuccessEnvelope = {
  success: boolean;
  [key: string]: unknown;
};

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<SuccessEnvelope> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();

    return next.handle().pipe(
      map((data: unknown): SuccessEnvelope => {
        if (this.isSuccessEnvelope(data)) {
          return data;
        }

        return {
          success: true,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          data,
        };
      }),
    );
  }

  private isSuccessEnvelope(data: unknown): data is SuccessEnvelope {
    return typeof data === 'object' && data !== null && 'success' in data;
  }
}
