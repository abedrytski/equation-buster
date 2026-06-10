// Boss — descriptor used for generic spec lookups (TYPES["boss"]). The actual
// boss entities are built by ./bosses (createBoss), which override hp/value/etc;
// this entry just supplies the defaults the engine reads for type "boss".
export default {
  id: "boss",
  color: "#a78bfa", radius: 40, speed: 18, value: 50, hp: 3, shape: "boss",
};
