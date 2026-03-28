# Oren Hack: Edu Platform

## Запуск проекта (Docker)

Для запуска нужен `Docker` и `Docker Compose`.

1. Запустите сервисы:

```bash
docker compose up --build -d
```

2. Проверьте, что сервисы поднялись:

```bash
docker compose ps
```

`.env` для базового запуска не обязателен: в `docker-compose.yml` для всех переменных заданы значения по умолчанию. Файл `.env` нужен только если хотите переопределить настройки.

## Доступ (демо, для допуска)

Если `SEED_DEMO_DATA=true` в env (по умолчанию), при старте автоматически создаются тестовые аккаунты:

- Учитель: `teacher@demo.local` / `teacher123`
- Ученик: `student@demo.local` / `student123`
- Родитель: `parent@demo.local` / `parent123`

Дополнительно:

- Код курса для записи ученика: `654321`
- Код привязки родителя к ученику: `123456`

## Полезные URL после запуска

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api`
- Swagger UI: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/api/health`

## Остановка проекта

```bash
docker compose down
```

С удалением тома БД:

```bash
docker compose down -v
```
