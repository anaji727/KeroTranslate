// Only trusted extension pages may access either storage area directly.
export async function initializeKeyStorage(storage){
  await Promise.all([storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
  const [local,legacy]=await Promise.all([storage.local.get('keys'),storage.session.get('keys')]);
  // A saved local record (including an empty one) takes precedence over old credentials.
  if(local.keys===undefined&&legacy.keys!==undefined)await storage.local.set({keys:legacy.keys});
  // Never discard the old copy until the persistent write succeeds.
  if(legacy.keys!==undefined)await storage.session.remove('keys');
}
