import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type User = z.infer<typeof UserSchema>;

const user: User = {
  name: "John",
  age: 30,
};

export const validateUser = (data: unknown) => {
  return UserSchema.parse(data);
};
