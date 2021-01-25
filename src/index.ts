import callsites from 'callsites';
import path from 'path';

export interface ISerializable {
  toJSON(): string;

  fromJSON<T extends ISerializable>(json: string): T;

  fromJSON<T extends ISerializable>(json: any): T;
}

export abstract class Index implements ISerializable {
  protected readonly classReference?: string;
  protected readonly className?: string;

  constructor() {
    this.className = this.constructor.name;

    for (const callsite of callsites()) {
      if (callsite.getFunctionName() === this.constructor.name) {
        this.classReference = path.relative(__dirname, callsite.getFileName()).split('.').slice(0, -1).join('.');
      }
    }
  }

  public static resolve<T extends Index>(className: string, classReference: string): T {
    try {
      const module = require('./' + classReference);

      const classType = [module, module?.default, module?.[className]].find((e) => e?.name === className);

      if (!classType || typeof classType !== 'function' || typeof classType.fromJSON !== 'function') {
        return null;
      }

      return classType;
    } catch {
      return null;
    }
  }

  public static fromJSON<T extends Index>(this: new (...a) => T, json: string): T;
  public static fromJSON<T extends Index>(this: new (...a) => T, json: any): T {
    if (typeof json === 'string') {
      return deserialize<T>(json);
    }

    return Object.assign(new this(), json);
  }

  public fromJSON<T extends Index>(json: string): T;
  public fromJSON<T extends Index>(json: any): T {
    if (typeof json === 'string') {
      return deserialize<T>(json);
    }

    return Object.assign(this, json);
  }

  public toJSON(): string {
    return serialize(this, true);
  }
}

export function serialize(json: any, std: boolean = false): string {
  const buffer = [];
  if (typeof json === 'object') {
    if (typeof json.toJSON === 'function' && !std) {
      buffer.push(json.toJSON());
    } else if (Array.isArray(json)) {
      const arrayBuffer = [];
      for (const entry of json) {
        arrayBuffer.push(serialize(entry));
      }
      buffer.push(`[${arrayBuffer.join(',')}]`);
    } else {
      const objectBuffer = [];
      for (const [key, value] of Object.entries(json)) {
        objectBuffer.push(`"${key}":${serialize(value)}`);
      }
      buffer.push(`{${objectBuffer.join(',')}}`);
    }
  } else {
    buffer.push(JSON.stringify(json));
  }
  return buffer.join(',');
}

export function deserialize<T extends Index>(json: string | any): T {
  return resolve<T>(typeof json === 'string' ? JSON.parse(json) : json);
}

export function resolve<T extends Index>(object: any): T | any {
  if (typeof object === 'object') {
    if (Array.isArray(object)) {
      return object.map((e) => resolve(e));
    }

    for (const [key, value] of Object.entries(object)) {
      object[key] = resolve(value);
    }

    if (
      typeof object?.className === 'string' &&
      typeof object?.classReference === 'string' &&
      typeof object?.fromJSON !== 'function'
    ) {
      const classType: T = Index.resolve<T>(object.className, object.classReference);
      if (classType) {
        object = classType.fromJSON<T>(object);
      }
    }
  }

  return object;
}
