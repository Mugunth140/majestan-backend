import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PropertyLocationDto } from './dto/create-property.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const parse = (value: unknown) => pipe.transform(value, { type: 'body', metatype: PropertyLocationDto });

describe('Property API coordinate validation', () => {
  it.each([{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: 90, longitude: -180 }, { latitude: 13.0827, longitude: 80.2707 }, {}])('accepts valid or omitted coordinates %j', async value => {
    await expect(parse(value)).resolves.toMatchObject(value);
  });
  it.each([{ latitude: 13000 }, { longitude: 80000 }, { latitude: -91 }, { longitude: -181 }, { latitude: NaN }])('returns an actionable 400 for invalid coordinates %j', async value => {
    try { await parse(value); throw new Error('Invalid coordinates accepted'); }
    catch (error) {
      expect(error.getStatus()).toBe(400);
      expect(JSON.stringify(error.getResponse())).toMatch(/latitude|longitude|Latitude|Longitude/);
    }
  });
});
