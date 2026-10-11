import test from "node:test";
import assert from "node:assert/strict";
import { parseDemoUsersCsv, syncDemoUsers } from "./createDemoAccounts.mjs";

function makeFakeClient(initialUsers = []) {
  const users = initialUsers.map((user) => structuredClone(user));
  const profiles = new Map();
  const calls = { create: 0, update: 0, profileUpsert: 0 };
  let failNextProfileWrite = false;

  const client = {
    auth: {
      admin: {
        async listUsers() {
          return { data: { users: structuredClone(users) }, error: null };
        },
        async createUser(attributes) {
          calls.create += 1;
          const user = {
            id: "demo-auth-" + calls.create,
            email: attributes.email,
            app_metadata: attributes.app_metadata,
            user_metadata: attributes.user_metadata,
          };
          users.push(user);
          return { data: { user: structuredClone(user) }, error: null };
        },
        async updateUserById(id, attributes) {
          calls.update += 1;
          const index = users.findIndex((user) => user.id === id);
          if (index < 0) return { data: null, error: { status: 404 } };
          users[index] = {
            ...users[index],
            app_metadata: attributes.app_metadata,
            user_metadata: attributes.user_metadata,
          };
          return { data: { user: structuredClone(users[index]) }, error: null };
        },
      },
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        upsert(profile) {
          calls.profileUpsert += 1;
          if (!failNextProfileWrite) profiles.set(profile.id, structuredClone(profile));
          const error = failNextProfileWrite ? { status: 503 } : null;
          failNextProfileWrite = false;
          return {
            select() {
              return {
                async single() {
                  if (error) return { data: null, error };
                  return { data: structuredClone(profiles.get(profile.id)), error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    client,
    users,
    profiles,
    calls,
    failNextProfileWrite() { failNextProfileWrite = true; },
  };
}

test("parses the supplied CSV shape, including quoted commas and optional locations", () => {
  const rows = parseDemoUsersCsv(
    'Role,Name,Email,Password,Location\r\nFarmer,"Ravi, Kumar",ravi@example.test,"safe-placeholder,one",Udupi\r\nBuyer,Coastal Buyer,buyer@example.test,another-placeholder,Mangaluru\r\n'
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].full_name, "Ravi, Kumar");
  assert.equal(rows[0].account_type, "farmer");
  assert.equal(rows[0].location, "Udupi");
  assert.equal(rows[1].account_type, "buyer");
});

test("rejects privileged or unsupported account types", () => {
  assert.throws(
    () => parseDemoUsersCsv("Role,Name,Email,Password\nadmin,Test,test@example.test,placeholder-password\n"),
    /only farmer and buyer are allowed/
  );
});

test("creates farmer and buyer Auth users and verifies matching profile IDs and fields", async () => {
  const fake = makeFakeClient();
  const users = [
    { email: "farmer@example.test", password: "placeholder-farmer-password", full_name: "Demo Farmer", account_type: "farmer", location: "Udupi" },
    { email: "buyer@example.test", password: "placeholder-buyer-password", full_name: "Demo Buyer", account_type: "buyer", location: "Mangaluru" },
  ];

  const results = await syncDemoUsers(users, fake.client);
  assert.deepEqual(results.map((result) => result.ok), [true, true]);
  assert.equal(fake.calls.create, 2);
  assert.equal(fake.profiles.size, 2);
  for (const [index, input] of users.entries()) {
    const authUser = fake.users[index];
    const profile = fake.profiles.get(authUser.id);
    assert.equal(profile.id, authUser.id);
    assert.equal(profile.full_name, input.full_name);
    assert.equal(profile.account_type, input.account_type);
    assert.equal(profile.location, input.location);
    assert.equal(authUser.user_metadata.account_type, input.account_type);
    assert.equal(authUser.app_metadata.krishi_samparka_demo, true);
  }
});

test("rerunning updates a managed demo account and does not create a duplicate", async () => {
  const fake = makeFakeClient();
  const user = { email: "farmer@example.test", password: "placeholder-password", full_name: "Demo Farmer", account_type: "farmer", location: "Udupi" };
  const first = await syncDemoUsers([user], fake.client);
  const second = await syncDemoUsers([user], fake.client);

  assert.equal(first[0].operation, "created");
  assert.equal(second[0].operation, "updated");
  assert.equal(fake.calls.create, 1);
  assert.equal(fake.calls.update, 1);
  assert.equal(fake.users.length, 1);
  assert.equal(fake.profiles.size, 1);
});

test("does not take over an existing account not marked as a demo", async () => {
  const fake = makeFakeClient([{ id: "existing-auth-id", email: "farmer@example.test", app_metadata: {} }]);
  const results = await syncDemoUsers([
    { email: "farmer@example.test", password: "placeholder-password", full_name: "Demo Farmer", account_type: "farmer", location: "Udupi" },
  ], fake.client);

  assert.equal(results[0].ok, false);
  assert.equal(fake.calls.create, 0);
  assert.equal(fake.calls.update, 0);
  assert.equal(fake.profiles.size, 0);
});

test("a profile write failure can be repaired on a repeat run without duplicating Auth", async () => {
  const fake = makeFakeClient();
  fake.failNextProfileWrite();
  const user = { email: "farmer@example.test", password: "placeholder-password", full_name: "Demo Farmer", account_type: "farmer", location: "Udupi" };
  const first = await syncDemoUsers([user], fake.client);
  const second = await syncDemoUsers([user], fake.client);

  assert.equal(first[0].stage, "Profile upsert");
  assert.equal(second[0].ok, true);
  assert.equal(fake.calls.create, 1);
  assert.equal(fake.calls.update, 1);
  assert.equal(fake.profiles.size, 1);
});
