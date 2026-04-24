import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const incomingRequestId = request.header('x-request-id');
    const requestId = incomingRequestId?.trim() || randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    next();
  }
}
