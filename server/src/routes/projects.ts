import { Router } from "express";
import type { ProjectStore } from "../store.js";

export function makeProjectsRouter(store: ProjectStore): Router {
  const router = Router();

  // POST /api/projects — create a new blank project
  router.post("/", async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    try {
      const version = await store.createProject(name.trim());
      res.status(201).json(version);
    } catch (err) {
      console.error("[projects] create failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // GET /api/projects — list available projects
  router.get("/", async (_req, res) => {
    try {
      const list = await store.listProjects();
      res.json(list);
    } catch (err) {
      console.error("[projects] list failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to list projects" });
    }
  });

  // GET /api/projects/:id — load the latest version of a project
  router.get("/:id", async (req, res) => {
    try {
      const version = await store.loadLatestVersion(req.params.id);
      if (!version) return res.status(404).json({ error: "Project not found" });
      res.json(version);
    } catch (err) {
      console.error("[projects] load failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to load project" });
    }
  });

  // PUT /api/projects/:id — save a new version
  router.put("/:id", async (req, res) => {
    try {
      const saved = await store.saveVersion(req.params.id, req.body);
      res.json(saved);
    } catch (err) {
      console.error("[projects] save failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  return router;
}
