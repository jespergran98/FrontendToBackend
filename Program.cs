var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Configure middleware
app.UseCors();

// In-memory task storage (in a real app, you'd use a database)
var tasks = new List<TaskItem>
{
    new() { Id = 1, Text = "Welcome to TaskFlow!", Completed = false, CreatedAt = DateTime.UtcNow },
    new() { Id = 2, Text = "Try adding your own task", Completed = false, CreatedAt = DateTime.UtcNow },
    new() { Id = 3, Text = "Mark tasks as complete by clicking the circle", Completed = true, CreatedAt = DateTime.UtcNow }
};
var nextId = 4;

// Serve static files for the frontend
app.UseStaticFiles();

// API Routes
app.MapGet("/", () => Results.Redirect("/index.html"));

// GET /api/tasks - Get all tasks
app.MapGet("/api/tasks", () =>
{
    return Results.Ok(new { success = true, data = tasks.OrderByDescending(t => t.CreatedAt) });
});

// GET /api/tasks/{id} - Get specific task
app.MapGet("/api/tasks/{id:int}", (int id) =>
{
    var task = tasks.FirstOrDefault(t => t.Id == id);
    if (task == null)
        return Results.NotFound(new { success = false, message = "Task not found" });
    
    return Results.Ok(new { success = true, data = task });
});

// POST /api/tasks - Create new task
app.MapPost("/api/tasks", async (TaskCreateRequest request) =>
{
    // Simulate some processing time
    await Task.Delay(200);
    
    if (string.IsNullOrWhiteSpace(request.Text))
        return Results.BadRequest(new { success = false, message = "Task text is required" });
    
    var task = new TaskItem
    {
        Id = nextId++,
        Text = request.Text.Trim(),
        Completed = false,
        CreatedAt = DateTime.UtcNow
    };
    
    tasks.Insert(0, task);
    
    return Results.Created($"/api/tasks/{task.Id}", 
        new { success = true, data = task, message = "Task created successfully" });
});

// PUT /api/tasks/{id} - Update task
app.MapPut("/api/tasks/{id:int}", async (int id, TaskUpdateRequest request) =>
{
    // Simulate some processing time
    await Task.Delay(150);
    
    var task = tasks.FirstOrDefault(t => t.Id == id);
    if (task == null)
        return Results.NotFound(new { success = false, message = "Task not found" });
    
    if (!string.IsNullOrWhiteSpace(request.Text))
        task.Text = request.Text.Trim();
    
    if (request.Completed.HasValue)
        task.Completed = request.Completed.Value;
    
    return Results.Ok(new { 
        success = true, 
        data = task, 
        message = task.Completed ? "Task completed!" : "Task updated successfully" 
    });
});

// DELETE /api/tasks/{id} - Delete task
app.MapDelete("/api/tasks/{id:int}", async (int id) =>
{
    // Simulate some processing time
    await Task.Delay(150);
    
    var task = tasks.FirstOrDefault(t => t.Id == id);
    if (task == null)
        return Results.NotFound(new { success = false, message = "Task not found" });
    
    tasks.Remove(task);
    
    return Results.Ok(new { success = true, message = "Task deleted successfully" });
});

// GET /api/tasks/stats - Get task statistics
app.MapGet("/api/tasks/stats", () =>
{
    var stats = new
    {
        total = tasks.Count,
        completed = tasks.Count(t => t.Completed),
        pending = tasks.Count(t => !t.Completed),
        completionRate = tasks.Count > 0 ? Math.Round((double)tasks.Count(t => t.Completed) / tasks.Count * 100, 1) : 0
    };
    
    return Results.Ok(new { success = true, data = stats });
});

app.Run();

// Data models
public class TaskItem
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TaskCreateRequest
{
    public string Text { get; set; } = string.Empty;
}

public class TaskUpdateRequest
{
    public string? Text { get; set; }
    public bool? Completed { get; set; }
}