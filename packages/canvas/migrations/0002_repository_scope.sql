ALTER TABLE canvases ADD COLUMN repository TEXT;
ALTER TABLE canvases ADD COLUMN pull_request INTEGER;
CREATE UNIQUE INDEX canvases_repository_pr ON canvases(repository, pull_request);
