import { GoalTreeBase } from 'edgemodel/GoalTreeBase';
import { GoalTree } from 'edgemodel/GoalTree';
import { Set } from 'ecore/Set';
import { Bag } from 'ecore/Bag';
import { Sequence } from 'ecore/Sequence';
import { Task } from 'edgemodel/Task';
import { Goal } from 'edgemodel/Goal';
import { Resource } from 'edgemodel/Resource';
import { Node } from 'edgemodel/Node';
import { GoalImpl } from 'edgemodel/GoalImpl';
import { TaskImpl } from 'edgemodel/TaskImpl';

export class GoalTreeImpl extends GoalTreeBase {
  /**
   * Returns all tasks in the goal tree
   */
  get allTasks(): Bag<Task> {
    const tasks = new Bag<Task>();
    if (this.root) {
      this.collectTasks(this.root, tasks);
    }
    return tasks;
  }

  /**
   * Returns all goals in the goal tree in sequence
   */
  get allGoals(): Sequence<Goal> {
    const goals = new Sequence<Goal>();
    if (this.root) {
      this.collectGoals(this.root, goals);
    }
    return goals;
  }

  /**
   * Returns all resources from all tasks in the goal tree
   */
  get allResource(): Bag<Resource> {
    const resources = new Bag<Resource>();
    const tasks = this.allTasks;

    // Iterate through all tasks and collect their resources
    for (let i = 0; i < tasks.size(); i++) {
      const task = tasks.at(i);
      if (task && task.resources) {
        // Add all resources from this task
        for (let j = 0; j < task.resources.size(); j++) {
          const resource = task.resources.at(j);
          if (resource) {
            resources.add(resource);
          }
        }
      }
    }

    return resources;
  }

  /**
   * Helper method to recursively collect all tasks from the tree
   */
  private collectTasks(node: Node, tasks: Bag<Task>): void {
    // Check if this node is a Task
    if (node instanceof TaskImpl) {
      tasks.add(node as Task);
    }

    // Traverse children if they exist
    if (node.child && node.child.outgoing) {
      for (let i = 0; i < node.child.outgoing.size(); i++) {
        const childGoal = node.child.outgoing.at(i);
        if (childGoal) {
          this.collectTasks(childGoal, tasks);
        }
      }
    }
  }

  /**
   * Helper method to recursively collect all goals from the tree
   */
  private collectGoals(node: Node, goals: Sequence<Goal>): void {
    // Check if this node is a Goal
    if (node instanceof GoalImpl) {
      goals.add(node as Goal);
    }

    // Traverse children if they exist
    if (node.child && node.child.outgoing) {
      for (let i = 0; i < node.child.outgoing.size(); i++) {
        const childGoal = node.child.outgoing.at(i);
        if (childGoal) {
          this.collectGoals(childGoal, goals);
        }
      }
    }
  }
}
