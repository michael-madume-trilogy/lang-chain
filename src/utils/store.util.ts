// this file handles data about a repository
import { exec } from "child_process";
import { join } from "path";
import { Project } from "ts-morph";
import { promisify } from "util";
import * as path from "path";
import { AST } from "src/models/ast.model";
import * as fs from "fs";
import { Element, load } from "cheerio";
import { createDocumentsFromInput } from "./document.util";
import { Document } from "langchain/document";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { confirm } from "@inquirer/prompts";

export const generateAST = async () => {
  let ast: AST = {};
  const dir = process.env.REPO_FOLDER_URL;
  if (!dir) {
    throw "No repository folder found";
  }
  ast = { ...ast, files: await getGitFiles(dir) };

  console.time();
  if (hasVectorStoreSetup()) {
    const reIndex = await confirm({
      message:
        "You have the vector stores setup. Would you want to re-index it? (will take about 8 mins)",
      default: false,
    });
    if (reIndex) {
      await indexRepo(ast);
    }
  } else {
    await indexRepo(ast);
  }
  console.timeEnd();
};

export const getGitFiles = async (directory: string): Promise<string[]> => {
  const execPromise = promisify(exec);

  const { stdout, stderr } = await execPromise("git ls-files", {
    cwd: directory,
  });

  if (stderr) {
    console.error(`Error: ${stderr}`);
    throw "Could not retrieve files";
  }

  return stdout.split("\n").filter((fileName) => fileName.length > 0);
};

export const indexRepo = async (ast: AST) => {
  console.time("AST");
  console.log("generating AST");
  ast = {
    ...ast,
    codebaseInfo: [
      ...handleTypeScriptFile(ast),
      ...handleHTMLFile(ast),
      ...handleJSONFile(ast),
    ],
  };

  const astVectorFolder = join(process.env.STORE_FOLDER_URL, "ast");
  const repoVectorFolder = join(process.env.STORE_FOLDER_URL, "repo");

  fs.mkdirSync(process.env.STORE_FOLDER_URL, { recursive: true });
  fs.mkdirSync(astVectorFolder, { recursive: true });
  fs.mkdirSync(repoVectorFolder, { recursive: true });

  fs.writeFileSync(
    join(process.env.STORE_FOLDER_URL, "ast.json"),
    JSON.stringify(ast, null, 2),
    "utf-8"
  );
  console.timeEnd("AST");

  console.log("creating documents");
  console.time("DOC");
  const astDocs: Document<Record<string, any>>[] = [];
  const documents: Document<Record<string, any>>[] = [];
  for (const val of ast.codebaseInfo) {
    const content = fs.readFileSync(
      join(process.env.REPO_FOLDER_URL, val.fileName),
      "utf8"
    );
    const doc = await createDocumentsFromInput(
      `file-path: ${val.fileName}
    
    ${content}
    `,
      {
        source: val.fileName,
      }
    );
    const astDoc = await createDocumentsFromInput(JSON.stringify(val), {
      source: val.fileName,
    });
    documents.push(...doc);
    astDocs.push(...astDoc);
  }
  console.timeEnd("DOC");

  console.log("creating vector store");
  console.time("VECTOR_STORE");
  const repoVectorStore = await HNSWLib.fromDocuments(
    documents,
    new OpenAIEmbeddings()
  );
  const astVectorStore = await HNSWLib.fromDocuments(
    astDocs,
    new OpenAIEmbeddings()
  );

  repoVectorStore.save(repoVectorFolder);
  astVectorStore.save(astVectorFolder);
  console.timeEnd("VECTOR_STORE");
};

export const handleTypeScriptFile = (ast: AST) => {
  const project = new Project({
    tsConfigFilePath: join(process.env.REPO_FOLDER_URL, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const files = ast.files.filter((file) => {
    return path.extname(file) === ".ts";
  });
  const sourceFiles = files.map((file) =>
    project.addSourceFileAtPath(join(process.env.REPO_FOLDER_URL, file))
  );
  return sourceFiles.map((sourceFile, i) => {
    // Get the imports
    const imports = sourceFile
      .getImportDeclarations()
      .map((importDeclaration) => importDeclaration.getModuleSpecifierValue());

    // Get the functions
    const functions = sourceFile.getFunctions().map((func) => ({
      name: func.getName(),
      parameters: func.getParameters().map((param) => ({
        name: param.getName(),
        type: param.getType()?.getText(),
      })),
      returnType: func.getReturnType().getText(),
    }));

    // Get the classes
    const classes = sourceFile.getClasses().map((classDeclaration) => {
      const methods = classDeclaration.getMethods().map((method) => ({
        name: method.getName(),
        parameters: method.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType()?.getText(),
        })),
        returnType: method.getReturnType().getText(),
        decorators: method.getDecorators().map((decorator) => ({
          name: decorator.getName(),
          arguments: decorator.getArguments().map((arg) => arg.getText()),
        })),
      }));

      const classDecorators = classDeclaration
        .getDecorators()
        .map((decorator) => ({
          name: decorator.getName(),
          arguments: decorator.getArguments().map((arg) => arg.getText()),
        }));

      return {
        name: classDeclaration.getName(),
        decorators: classDecorators,
        methods,
      };
    });

    // Get the interfaces
    const interfaces = sourceFile
      .getInterfaces()
      .map((interfaceDeclaration) => ({
        name: interfaceDeclaration.getName(),
        properties: interfaceDeclaration.getProperties().map((property) => ({
          name: property.getName(),
          type: property.getType().getText(),
        })),
      }));

    // Store the information
    return {
      fileName: files[i],
      imports,
      functions,
      classes,
      interfaces,
    };
  });
};

export const handleHTMLFile = (ast: AST) => {
  const files = ast.files.filter((file) => {
    return path.extname(file) === ".html";
  });

  return files.map((file) => {
    const content = fs.readFileSync(
      join(process.env.REPO_FOLDER_URL, file),
      "utf8"
    );
    const $ = load(content);

    // Get all the tags
    const tags: {
      tag: string;
      attrs: {
        [name: string]: string;
      };
    }[] = [];
    $("*").map((_, element: Element) => {
      tags.push({
        tag: element.name,
        attrs: element.attribs,
      });
    });

    // Store the information
    return {
      fileName: file,
      tags,
    };
  });
};

export const handleJSONFile = (ast: AST) => {
  const files = ast.files.filter((file) => {
    return path.extname(file) === ".json";
  });

  return files.map((file) => {
    const content = fs.readFileSync(
      join(process.env.REPO_FOLDER_URL, file),
      "utf8"
    );
    let json = {};
    try {
      json = JSON.parse(content);
    } catch (error) {}
    // Store the information
    return {
      fileName: file,
      json,
    };
  });
};

export const hasVectorStoreSetup = () => {
  const dir = process.env.STORE_FOLDER_URL;
  const files = ["args.json", "docstore.json", "hnswlib.index"];
  const folders = ["ast", "repo"];
  const testFiles = files
    .map((val) => {
      return folders.map((t) => path.join(dir, t, val));
    })
    .flat();
  return testFiles.every((file) => fs.existsSync(file));
};
