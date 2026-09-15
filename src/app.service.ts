import { Injectable } from "@nestjs/common";

// NestJS 的 IoC 容器会自动创建、管理它的实例，并在其他地方（比如 Controller）需要它时自动注入进去。
@Injectable()
// 3. 定义并导出一个名为 AppService 的普通 TypeScript 类。
// Service（服务层）的职责是处理具体的业务逻辑（如操作数据库、调用第三方接口等）。
export class AppService {
  getHello(): string {
    return "Hello World!";
  }
}
