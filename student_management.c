#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <conio.h>

#define MAX_NAME 20
#define MAX_STUDENTS 100
#define FILENAME "students.dat"

typedef struct {
    int id;
    char name[MAX_NAME];
    int age;
    float score;
} Student;

Student students[MAX_STUDENTS];
int count = 0;

void load();
void save();
void menu();
void add();
void del();
void update();
void query();
void list();
void press_any_key();

int main() {
    load();
    while (1) menu();
    return 0;
}

void load() {
    FILE *fp = fopen(FILENAME, "rb");
    if (!fp) return;
    count = fread(students, sizeof(Student), MAX_STUDENTS, fp);
    fclose(fp);
}

void save() {
    FILE *fp = fopen(FILENAME, "wb");
    if (!fp) { printf("\n保存失败！\n"); return; }
    fwrite(students, sizeof(Student), count, fp);
    fclose(fp);
}

void menu() {
    system("cls");
    printf("====================================\n");
    printf("        学生管理系统 v1.0\n");
    printf("====================================\n");
    printf("  1. 添加学生\n");
    printf("  2. 删除学生\n");
    printf("  3. 修改学生\n");
    printf("  4. 查询学生\n");
    printf("  5. 浏览全部\n");
    printf("  6. 退出系统\n");
    printf("====================================\n");
    printf("当前学生人数: %d\n", count);
    printf("请选择(1-6): ");

    char ch = getch();
    printf("%c\n", ch);
    switch (ch) {
        case '1': add(); break;
        case '2': del(); break;
        case '3': update(); break;
        case '4': query(); break;
        case '5': list(); break;
        case '6':
            save();
            printf("\n谢谢使用！\n");
            exit(0);
        default:
            printf("\n输入有误，请重新选择！\n");
            press_any_key();
    }
}

int find_by_id(int id) {
    for (int i = 0; i < count; i++)
        if (students[i].id == id) return i;
    return -1;
}

void add() {
    system("cls");
    printf("====== 添加学生 ======\n");
    if (count >= MAX_STUDENTS) {
        printf("学生已满，无法添加！\n");
        press_any_key();
        return;
    }

    Student s;
    printf("请输入学号: ");
    scanf("%d", &s.id);
    while (getchar() != '\n');

    if (find_by_id(s.id) != -1) {
        printf("学号已存在！\n");
        press_any_key();
        return;
    }

    printf("请输入姓名: ");
    fgets(s.name, MAX_NAME, stdin);
    s.name[strcspn(s.name, "\n")] = '\0';

    printf("请输入年龄: ");
    scanf("%d", &s.age);

    printf("请输入成绩: ");
    scanf("%f", &s.score);
    while (getchar() != '\n');

    students[count++] = s;
    save();
    printf("\n添加成功！\n");
    press_any_key();
}

void del() {
    system("cls");
    printf("====== 删除学生 ======\n");
    if (count == 0) {
        printf("当前无学生数据！\n");
        press_any_key();
        return;
    }

    int id;
    printf("请输入要删除的学号: ");
    scanf("%d", &id);

    int idx = find_by_id(id);
    if (idx == -1) {
        printf("未找到该学号！\n");
        press_any_key();
        return;
    }

    printf("\n学号: %d  姓名: %s  年龄: %d  成绩: %.1f\n",
           students[idx].id, students[idx].name,
           students[idx].age, students[idx].score);
    printf("确认删除？(y/n): ");
    char ch = getch();
    printf("%c\n", ch);
    if (ch != 'y' && ch != 'Y') {
        printf("已取消删除。\n");
        press_any_key();
        return;
    }

    for (int i = idx; i < count - 1; i++)
        students[i] = students[i + 1];
    count--;
    save();
    printf("删除成功！\n");
    press_any_key();
}

void update() {
    system("cls");
    printf("====== 修改学生 ======\n");
    if (count == 0) {
        printf("当前无学生数据！\n");
        press_any_key();
        return;
    }

    int id;
    printf("请输入要修改的学号: ");
    scanf("%d", &id);
    while (getchar() != '\n');

    int idx = find_by_id(id);
    if (idx == -1) {
        printf("未找到该学号！\n");
        press_any_key();
        return;
    }

    printf("\n当前信息: 学号: %d  姓名: %s  年龄: %d  成绩: %.1f\n\n",
           students[idx].id, students[idx].name,
           students[idx].age, students[idx].score);

    printf("请输入新姓名(直接回车不修改): ");
    char buf[MAX_NAME];
    fgets(buf, MAX_NAME, stdin);
    if (buf[0] != '\n') {
        buf[strcspn(buf, "\n")] = '\0';
        strcpy(students[idx].name, buf);
    }

    printf("请输入新年龄(-1不修改): ");
    int age;
    scanf("%d", &age);
    if (age != -1) students[idx].age = age;

    printf("请输入新成绩(-1不修改): ");
    float score;
    scanf("%f", &score);
    if (score != -1) students[idx].score = score;
    while (getchar() != '\n');

    save();
    printf("\n修改成功！\n");
    press_any_key();
}

void query() {
    system("cls");
    printf("====== 查询学生 ======\n");
    if (count == 0) {
        printf("当前无学生数据！\n");
        press_any_key();
        return;
    }

    int id;
    printf("请输入学号: ");
    scanf("%d", &id);

    int idx = find_by_id(id);
    if (idx == -1) {
        printf("未找到该学号！\n");
        press_any_key();
        return;
    }

    printf("\n===== 学生信息 =====\n");
    printf("  学号: %d\n", students[idx].id);
    printf("  姓名: %s\n", students[idx].name);
    printf("  年龄: %d\n", students[idx].age);
    printf("  成绩: %.1f\n", students[idx].score);
    printf("====================\n");
    press_any_key();
}

void list() {
    system("cls");
    printf("====== 全部学生 ======\n");
    if (count == 0) {
        printf("当前无学生数据！\n");
        press_any_key();
        return;
    }

    printf("\n%-6s %-10s %-4s %-6s\n", "学号", "姓名", "年龄", "成绩");
    printf("------------------------------\n");
    for (int i = 0; i < count; i++) {
        printf("%-6d %-10s %-4d %-6.1f\n",
               students[i].id, students[i].name,
               students[i].age, students[i].score);
    }
    printf("\n共 %d 名学生\n", count);
    press_any_key();
}

void press_any_key() {
    printf("\n按任意键返回菜单...");
    getch();
}
