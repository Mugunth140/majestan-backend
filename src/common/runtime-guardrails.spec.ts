import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { RuntimeGuardrails } from './runtime-guardrails';

class TestResponse extends EventEmitter {
  setHeader = jest.fn();
  status = jest.fn().mockReturnThis();
  json = jest.fn().mockReturnThis();
  asResponse(): Response {
    return this as unknown as Response;
  }
}
const request = {} as Request;
const response = () => new TestResponse();

describe('RuntimeGuardrails', () => {
  it('rejects excess traffic without queueing and admits again after completion', () => {
    const guard = new RuntimeGuardrails(1);
    const next = jest.fn();
    const first = response();
    const second = response();
    guard.middleware(request, first.asResponse(), next);
    guard.middleware(request, second.asResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(second.status).toHaveBeenCalledWith(503);
    expect(second.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(guard.snapshot()).toMatchObject({
      activeResponses: 1,
      rejectedRequests: 1,
    });
    first.emit('finish');
    first.emit('close');
    guard.middleware(request, response().asResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(guard.snapshot()).toMatchObject({
      activeResponses: 1,
      completedResponses: 1,
    });
    expect(first.listenerCount('finish') + first.listenerCount('close')).toBe(
      0,
    );
  });

  it('releases disconnected responses and counts them only once', () => {
    const guard = new RuntimeGuardrails(1);
    const res = response();
    guard.middleware(request, res.asResponse(), jest.fn());
    res.emit('close');
    res.emit('finish');
    expect(guard.snapshot()).toMatchObject({
      activeResponses: 0,
      completedResponses: 1,
    });
    expect(res.listenerCount('finish') + res.listenerCount('close')).toBe(0);
  });

  it('keeps active counts across measurement intervals and resets interval totals', () => {
    const guard = new RuntimeGuardrails(2);
    guard.middleware(request, response().asResponse(), jest.fn());
    const res = response();
    guard.middleware(request, res.asResponse(), jest.fn());
    res.emit('finish');
    expect(guard.snapshot()).toMatchObject({
      activeResponses: 1,
      peakResponses: 2,
      completedResponses: 1,
    });
    expect(guard.snapshot()).toMatchObject({
      activeResponses: 1,
      peakResponses: 1,
      completedResponses: 0,
    });
  });
});
