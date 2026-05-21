import { describe, it, expect } from 'vitest';

import { validateHomeUrl } from './thumbnail-url';


describe('validateHomeUrl', () => {

  it('accepts plain https URL', () => {

    expect(validateHomeUrl('https://example.com')).toEqual({ ok: true });
  });


  it('accepts http URL with path and query', () => {

    expect(validateHomeUrl('http://example.com/foo?bar=1')).toEqual({ ok: true });
  });


  it('rejects unparseable garbage', () => {

    expect(validateHomeUrl('not a url')).toEqual({ ok: false, reason: 'parse' });
  });


  it('rejects non-http(s) protocols', () => {

    expect(validateHomeUrl('ftp://example.com')).toEqual({ ok: false, reason: 'protocol' });
    expect(validateHomeUrl('file:///etc/passwd')).toEqual({ ok: false, reason: 'protocol' });
    expect(validateHomeUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'protocol' });
  });


  it('rejects localhost and loopback', () => {

    expect(validateHomeUrl('http://localhost')).toEqual({ ok: false, reason: 'private' });
    expect(validateHomeUrl('http://127.0.0.1:8080')).toEqual({ ok: false, reason: 'private' });
  });


  it('rejects RFC1918 private ranges', () => {

    expect(validateHomeUrl('http://10.0.0.1')).toEqual({ ok: false, reason: 'private' });
    expect(validateHomeUrl('http://192.168.1.1')).toEqual({ ok: false, reason: 'private' });
    expect(validateHomeUrl('http://172.16.0.1')).toEqual({ ok: false, reason: 'private' });
    expect(validateHomeUrl('http://172.31.255.255')).toEqual({ ok: false, reason: 'private' });
  });


  it('rejects link-local 169.254.x.x', () => {

    expect(validateHomeUrl('http://169.254.169.254')).toEqual({ ok: false, reason: 'private' });
  });


  it('allows public IPv4', () => {

    expect(validateHomeUrl('http://8.8.8.8')).toEqual({ ok: true });
  });
});
