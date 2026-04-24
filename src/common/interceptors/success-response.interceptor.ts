import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'object' && data !== null && 'success' in data) {
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
}
