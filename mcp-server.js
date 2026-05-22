#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const { SYSTEM_PROMPT, PILARES, buildUserPrompt } = require("./savia.prompt");
const {
  guardarBorrador,
  listarBorradores,
  obtenerBorrador,
  actualizarBorrador,
  aprobarPost,
  listarAprobados,
} = require("./storage");

const server = new Server(
  { name: "savia-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ─── DEFINICIÓN DE TOOLS ────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "savia_get_prompt",
      description:
        "Devuelve el system prompt de SavIA y el user prompt listo para que el LLM genere el post. Úsalo ANTES de generar contenido para SavIA.",
      inputSchema: {
        type: "object",
        properties: {
          pilar: {
            type: "number",
            enum: [1, 2, 3, 4],
            description:
              "Pilar de contenido: 1=Empatía, 2=Claridad, 3=Primer paso, 4=Contexto actual",
          },
          tema: {
            type: "string",
            description: "Tema específico del post (opcional)",
          },
          contexto: {
            type: "string",
            description: "Contexto adicional para personalizar el post (opcional)",
          },
        },
        required: ["pilar"],
      },
    },
    {
      name: "savia_get_edit_prompt",
      description:
        "Devuelve el system prompt y el user prompt para iterar un borrador existente. Úsalo cuando el usuario quiera modificar un post ya guardado.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "ID del borrador a editar (ej: B001)",
          },
          instruccion: {
            type: "string",
            description: "Instrucción de cambio en lenguaje natural",
          },
        },
        required: ["id", "instruccion"],
      },
    },
    {
      name: "savia_guardar",
      description:
        "Guarda un post generado por el LLM como borrador. Llámalo después de generar con savia_get_prompt.",
      inputSchema: {
        type: "object",
        properties: {
          pilar: {
            type: "number",
            enum: [1, 2, 3, 4],
          },
          tema: {
            type: "string",
            description: "Tema del post (opcional)",
          },
          contenido: {
            type: "string",
            description: "Texto completo del post generado",
          },
        },
        required: ["pilar", "contenido"],
      },
    },
    {
      name: "savia_guardar_edicion",
      description:
        "Guarda la versión editada de un borrador existente. Llámalo después de iterar con savia_get_edit_prompt.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "ID del borrador editado",
          },
          contenido: {
            type: "string",
            description: "Texto actualizado del post",
          },
        },
        required: ["id", "contenido"],
      },
    },
    {
      name: "savia_listar",
      description: "Lista borradores o posts aprobados de SavIA.",
      inputSchema: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["borradores", "aprobados"],
            description: "Qué lista mostrar (default: borradores)",
          },
        },
      },
    },
    {
      name: "savia_ver",
      description: "Ver el contenido completo de un borrador por su ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del borrador (ej: B001)" },
        },
        required: ["id"],
      },
    },
    {
      name: "savia_aprobar",
      description: "Mueve un borrador a la lista de posts aprobados listos para publicar.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del borrador a aprobar" },
        },
        required: ["id"],
      },
    },
  ],
}));

// ─── EJECUCIÓN DE TOOLS ─────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case "savia_get_prompt": {
        const { pilar, tema, contexto } = args;
        const userPrompt = buildUserPrompt({ pilar, tema, contexto });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              system_prompt: SYSTEM_PROMPT,
              user_prompt: userPrompt,
              pilar,
              pilar_nombre: PILARES[pilar],
            }),
          }],
        };
      }

      case "savia_get_edit_prompt": {
        const { id, instruccion } = args;
        const post = obtenerBorrador(id.toUpperCase());
        if (!post) {
          return {
            content: [{ type: "text", text: `Borrador ${id} no encontrado.` }],
            isError: true,
          };
        }
        const userPrompt = buildUserPrompt({ postActual: post.contenido, instruccion });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              system_prompt: SYSTEM_PROMPT,
              user_prompt: userPrompt,
              id: post.id,
            }),
          }],
        };
      }

      case "savia_guardar": {
        const { pilar, tema, contenido } = args;
        const id = guardarBorrador({ pilar, tema, contenido });
        return {
          content: [{ type: "text", text: `✓ Borrador guardado con ID: ${id}` }],
        };
      }

      case "savia_guardar_edicion": {
        const { id, contenido } = args;
        actualizarBorrador(id.toUpperCase(), contenido);
        return {
          content: [{ type: "text", text: `✓ Borrador ${id.toUpperCase()} actualizado.` }],
        };
      }

      case "savia_listar": {
        const { tipo = "borradores" } = args || {};
        const posts = tipo === "aprobados" ? listarAprobados() : listarBorradores();
        if (posts.length === 0) {
          return { content: [{ type: "text", text: `No hay ${tipo} todavía.` }] };
        }
        const lista = posts.map((p) => {
          const fecha = new Date(p.creadoEn).toLocaleDateString("es-MX");
          const preview = p.contenido.slice(0, 80).replace(/\n/g, " ");
          return `${p.id} [Pilar ${p.pilar}] ${fecha}\n  ${preview}...`;
        }).join("\n\n");
        return { content: [{ type: "text", text: `${posts.length} ${tipo}:\n\n${lista}` }] };
      }

      case "savia_ver": {
        const { id } = args;
        const post = obtenerBorrador(id.toUpperCase());
        if (!post) {
          return { content: [{ type: "text", text: `Borrador ${id} no encontrado.` }], isError: true };
        }
        return {
          content: [{
            type: "text",
            text: `${post.id} — Pilar ${post.pilar}: ${PILARES[post.pilar]}\n\n${"─".repeat(50)}\n${post.contenido}\n${"─".repeat(50)}`,
          }],
        };
      }

      case "savia_aprobar": {
        const { id } = args;
        const post = aprobarPost(id.toUpperCase());
        return { content: [{ type: "text", text: `✓ Post ${post.id} aprobado y listo para publicar.` }] };
      }

      default:
        return { content: [{ type: "text", text: `Tool desconocida: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Error fatal: ${err.message}\n`);
  process.exit(1);
});
