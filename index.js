#!/usr/bin/env node

const { program } = require("commander");
const chalk = require("chalk");
const ora = require("ora");
const readline = require("readline");
const { generarPost, iterarPost, PILARES } = require("./generator");
const {
  guardarBorrador,
  listarBorradores,
  obtenerBorrador,
  actualizarBorrador,
  aprobarPost,
  listarAprobados,
} = require("./storage");

function pregunta(rl, texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

// ─── GENERAR ────────────────────────────────────────────────────────────────
program
  .command("generar")
  .description("Genera un nuevo post para SavIA")
  .option("-p, --pilar <numero>", "Pilar de contenido (1-4)")
  .option("-t, --tema <texto>", "Tema específico del post")
  .option("-c, --contexto <texto>", "Contexto adicional para el post")
  .action(async (options) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    let pilar = parseInt(options.pilar);
    let tema = options.tema;

    if (!pilar || pilar < 1 || pilar > 4) {
      console.log(chalk.cyan("\n¿Qué pilar quieres usar?\n"));
      Object.entries(PILARES).forEach(([num, desc]) => {
        console.log(chalk.white(`  ${chalk.bold(num)}. ${desc}`));
      });
      const resp = await pregunta(rl, chalk.yellow("\nElige (1-4): "));
      pilar = parseInt(resp);
    }

    if (!tema) {
      tema = await pregunta(rl, chalk.yellow("Tema o idea (opcional, Enter para omitir): "));
      tema = tema.trim() || null;
    }

    rl.close();

    const spinner = ora(chalk.cyan("Generando post...")).start();

    try {
      const contenido = await generarPost({ pilar, tema, contexto: options.contexto });
      spinner.succeed(chalk.green("Post generado\n"));

      console.log(chalk.gray("─".repeat(60)));
      console.log(chalk.white(contenido));
      console.log(chalk.gray("─".repeat(60)));

      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      const accion = await pregunta(
        rl2,
        chalk.yellow("\n¿Qué hacemos? [g]uardar borrador / [r]egenerar / [s]alir: ")
      );

      if (accion.toLowerCase() === "g") {
        const id = guardarBorrador({ pilar, tema, contenido });
        console.log(chalk.green(`\n✓ Guardado como borrador ${chalk.bold(id)}`));
      } else if (accion.toLowerCase() === "r") {
        rl2.close();
        const spinner2 = ora(chalk.cyan("Regenerando...")).start();
        const nuevo = await generarPost({ pilar, tema, contexto: options.contexto });
        spinner2.succeed(chalk.green("Post regenerado\n"));
        console.log(chalk.gray("─".repeat(60)));
        console.log(chalk.white(nuevo));
        console.log(chalk.gray("─".repeat(60)));
        const id = guardarBorrador({ pilar, tema, contenido: nuevo });
        console.log(chalk.green(`\n✓ Guardado como borrador ${chalk.bold(id)}`));
        return;
      }

      rl2.close();
    } catch (err) {
      spinner.fail(chalk.red("Error al generar"));
      console.error(chalk.red(err.message));
    }
  });

// ─── LISTAR ─────────────────────────────────────────────────────────────────
program
  .command("listar")
  .description("Lista borradores o posts aprobados")
  .option("-a, --aprobados", "Listar posts aprobados en vez de borradores")
  .action((options) => {
    const posts = options.aprobados ? listarAprobados() : listarBorradores();
    const tipo = options.aprobados ? "aprobados" : "borradores";

    if (posts.length === 0) {
      console.log(chalk.yellow(`\nNo hay ${tipo} todavía.`));
      return;
    }

    console.log(chalk.cyan(`\n${posts.length} ${tipo}:\n`));
    posts.forEach((p) => {
      const fecha = new Date(p.creadoEn).toLocaleDateString("es-MX");
      const preview = p.contenido.slice(0, 60).replace(/\n/g, " ");
      console.log(
        `${chalk.bold(chalk.white(p.id))} ${chalk.gray(`[Pilar ${p.pilar}]`)} ${chalk.gray(fecha)}`
      );
      console.log(`  ${chalk.white(preview)}...`);
      console.log();
    });
  });

// ─── VER ────────────────────────────────────────────────────────────────────
program
  .command("ver <id>")
  .description("Ver el contenido completo de un borrador")
  .action((id) => {
    const post = obtenerBorrador(id.toUpperCase());
    if (!post) {
      console.log(chalk.red(`\nBorrador ${id} no encontrado.`));
      return;
    }
    console.log(chalk.cyan(`\n${post.id} — Pilar ${post.pilar} — ${PILARES[post.pilar]}\n`));
    console.log(chalk.gray("─".repeat(60)));
    console.log(chalk.white(post.contenido));
    console.log(chalk.gray("─".repeat(60)));
  });

// ─── EDITAR ─────────────────────────────────────────────────────────────────
program
  .command("editar <id>")
  .description("Iterar un borrador existente con instrucciones")
  .action(async (id) => {
    const post = obtenerBorrador(id.toUpperCase());
    if (!post) {
      console.log(chalk.red(`\nBorrador ${id} no encontrado.`));
      return;
    }

    console.log(chalk.cyan(`\nPost actual (${id}):\n`));
    console.log(chalk.gray("─".repeat(60)));
    console.log(chalk.white(post.contenido));
    console.log(chalk.gray("─".repeat(60)));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const instruccion = await pregunta(rl, chalk.yellow("\n¿Cómo lo cambiamos?: "));
    rl.close();

    const spinner = ora(chalk.cyan("Iterando post...")).start();

    try {
      const nuevo = await iterarPost({ postActual: post.contenido, instruccion });
      spinner.succeed(chalk.green("Post actualizado\n"));

      console.log(chalk.gray("─".repeat(60)));
      console.log(chalk.white(nuevo));
      console.log(chalk.gray("─".repeat(60)));

      actualizarBorrador(id.toUpperCase(), nuevo);
      console.log(chalk.green(`\n✓ Borrador ${chalk.bold(id.toUpperCase())} actualizado`));
    } catch (err) {
      spinner.fail(chalk.red("Error al iterar"));
      console.error(chalk.red(err.message));
    }
  });

// ─── APROBAR ────────────────────────────────────────────────────────────────
program
  .command("aprobar <id>")
  .description("Mover un borrador a posts aprobados")
  .action((id) => {
    try {
      const post = aprobarPost(id.toUpperCase());
      console.log(chalk.green(`\n✓ Post ${chalk.bold(post.id)} aprobado y listo para publicar.`));
    } catch (err) {
      console.log(chalk.red(`\n${err.message}`));
    }
  });

program
  .name("savia")
  .description(chalk.cyan("SavIA — Generador de contenido para Facebook"))
  .version("1.0.0");

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
