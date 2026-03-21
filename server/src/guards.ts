import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

export function getDirSize(dir: string): number {
  try {
    const files = fs.readdirSync(dir);
    return files.reduce((total, file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      return total + (stat.isFile() ? stat.size : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export function storageGuard(uploadDir: string, maxStorageMb: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentSize = getDirSize(uploadDir);
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const maxBytes = maxStorageMb * 1024 * 1024;
    if (currentSize + contentLength > maxBytes) {
      return res.status(507).json({ error: "Storage limit reached" });
    }
    next();
  };
}

export function sessionLimitGuard(getSessionCount: () => number, maxSessions: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (getSessionCount() >= maxSessions) {
      return res.status(507).json({ error: "Session limit reached" });
    }
    next();
  };
}
