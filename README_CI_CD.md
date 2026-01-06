# 🚀 CI/CD con AWS - Resumen Rápido

Este proyecto incluye configuración de CI/CD usando **AWS CodePipeline** y **CodeBuild**, compatible con el **Free Tier de AWS**.

## 📁 Archivos de CI/CD

- `buildspec.yml` - Especificación de build para CodeBuild
- `.dockerignore` - Archivos a excluir del contexto Docker

## ⚡ Inicio Rápido

1. **Revisa la guía completa**: `../infra/CI_CD_SETUP.md`

2. **Configura el pipeline** editando `../infra/bin/trabajoya-infra.ts` y agregando el stack de CI/CD

3. **Despliega**:
   ```bash
   cd ../infra
   npm run deploy:prod
   ```

## 🎯 Qué hace el Pipeline

1. **Source**: Obtiene código desde GitHub/CodeCommit
2. **Build**: Compila la imagen Docker con `Dockerfile.prod`
3. **Push**: Sube la imagen a ECR (Amazon Elastic Container Registry)

## 📊 Free Tier

- ✅ 1 pipeline activo/mes gratis
- ✅ 100 minutos de build/mes gratis  
- ✅ 500MB ECR storage/mes gratis

Ver detalles completos en `../infra/CI_CD_SETUP.md`

