#!/usr/bin/env node
import { parseArgs } from "./cli.js";
import { createNodeHost, run } from "./run.js";

process.exit(run(parseArgs(process.argv.slice(2)), createNodeHost()));
