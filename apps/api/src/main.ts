import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

// BigInt não tem serialização JSON nativa (JSON.stringify lança em qualquer
// resposta que inclua um campo BigInt, ex.: entry_number, document_number).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Santos Sistema Administrativo Financeiro")
    .setDescription("API da fundação multi-tenant (auth/RBAC, plano de contas, lançamentos contábeis)")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // Sem rota nenhuma mapeada em "/" — quem abre o domínio pelado cai num 404
  // sem contexto. Redireciona pra documentação.
  app.getHttpAdapter().get("/", (_req, res) => res.redirect("/api/docs"));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
