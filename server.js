import "dotenv/config";
import express from "express";
import { eq } from "drizzle-orm";

import { db } from "./db/index.js";
import { members } from "./db/schema.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Helper: validate member IDs
function getMemberId(value) {
  const id = Number(value);

  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > 2147483647
  ) {
    return null;
  }

  return id;
}

// Helper: validate name
function validName(name) {
  return (
    typeof name === "string" &&
    name.trim().length >= 1 &&
    name.trim().length <= 255
  );
}

// Helper: send errors consistently
function sendError(res, status, code, message, field = null) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message, field },
  });
}

// GET: Fetch all members
app.get("/api/members", async (req, res) => {
  try {
    const allMembers = await db.select().from(members);

    return res.status(200).json({
      success: true,
      data: allMembers,
      error: null,
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch members");
  }
});

// GET: Fetch a single member
app.get("/api/members/:id", async (req, res) => {
  try {
    const id = getMemberId(req.params.id);

    if (id === null) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid member ID", "id");
    }

    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!member) {
      return sendError(res, 404, "NOT_FOUND", "Member not found");
    }

    return res.status(200).json({
      success: true,
      data: member,
      error: null,
    });
  } catch (error) {
    console.error("Failed to fetch member:", error);

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch member");
  }
});

// POST: Create a new member
app.post("/api/members", async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendError(res, 400, "INVALID_BODY", "Body must be a JSON object");
    }

    const { name } = body;

    if (!validName(name)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Name must contain between 1 and 255 characters",
        "name",
      );
    }

    const [member] = await db
      .insert(members)
      .values({ name: name.trim() })
      .returning();

    return res.status(201).json({
      success: true,
      data: member,
      error: null,
    });
  } catch (error) {
    console.error("Failed to create member:", error);

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to create member");
  }
});

// PATCH: Update an existing member
app.patch("/api/members/:id", async (req, res) => {
  try {
    const id = getMemberId(req.params.id);

    if (id === null) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid member ID", "id");
    }

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "name")
    ) {
      return sendError(res, 400, "INVALID_BODY", "Provide only the name field");
    }

    if (!validName(body.name)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Name must contain between 1 and 255 characters",
        "name",
      );
    }

    const [member] = await db
      .update(members)
      .set({ name: body.name.trim() })
      .where(eq(members.id, id))
      .returning();

    if (!member) {
      return sendError(res, 404, "NOT_FOUND", "Member not found");
    }

    return res.status(200).json({
      success: true,
      data: member,
      error: null,
    });
  } catch (error) {
    console.error("Failed to update member:", error);

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to update member");
  }
});

// DELETE: Remove a member
app.delete("/api/members/:id", async (req, res) => {
  try {
    const id = getMemberId(req.params.id);

    if (id === null) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid member ID", "id");
    }

    const [member] = await db
      .delete(members)
      .where(eq(members.id, id))
      .returning();

    if (!member) {
      return sendError(res, 404, "NOT_FOUND", "Member not found");
    }

    return res.status(200).json({
      success: true,
      data: member,
      error: null,
    });
  } catch (error) {
    console.error("Failed to delete member:", error);

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to delete member");
  }
});

// Handle malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return sendError(
      res,
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    );
  }

  console.error("Request error:", err);
  return sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
