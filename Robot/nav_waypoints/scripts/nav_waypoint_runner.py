#!/usr/bin/env python3
import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
import yaml
import os
from std_msgs.msg import String, Int32
from geometry_msgs.msg import PoseStamped, Quaternion
from nav2_msgs.action import NavigateToPose
import math
from ament_index_python.packages import get_package_share_directory
import sys


def get_quaternion():
    q = Quaternion()
    q.w = 1.0
    q.x = 0.0
    q.y = 0.0
    q.z = 0.0
    return q


class WaypointRunner(Node):
    def __init__(self):
        super().__init__('nav_waypoint_runner')
        package_name = 'nav_waypoints'  # your package name
        cfg = os.path.join(
            get_package_share_directory(package_name),
            'config',
            'waypoints.yaml'
        )
        try:
            with open(cfg, 'r') as f:
                data = yaml.safe_load(f)
        except Exception:
            self.get_logger().error(f'Failed reading waypoints file: {cfg}')
            sys.exit(1)
        self.waypoints = data.get('waypoints', [])
        self._nav_client = ActionClient(self, NavigateToPose, 'navigate_to_pose')
        self.aisle_pub = self.create_publisher(String, 'current_aisle', 10)
        self.count_trigger = self.create_publisher(Int32, 'start_count', 10)
        self.get_logger().info(f'Loaded {len(self.waypoints)} waypoints')
        self._current_index = 0
        self.timer = self.create_timer(1.0, self._run_once)
        self._started = False


    def _run_once(self):
        if self._started:
            return
        self._started = True
        self.timer.cancel()
        self._process_waypoints()

    def _send_goal(self, pose_stamped):
        goal_msg = NavigateToPose.Goal()
        goal_msg.pose = pose_stamped
        try:
            self._nav_client.wait_for_server()
            send_goal_future = self._nav_client.send_goal_async(goal_msg)
            send_goal_future.add_done_callback(self._goal_response_callback)

        except Exception as e:
            self.get_logger().error(f'Exception in _send_goal: {e}')
            return False

    def _goal_response_callback(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('Goal rejected by action server')
            return
        self.get_logger().info('Goal accepted, waiting for result...')
        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(self._get_result_callback)

    def _get_result_callback(self, future):
        result = future.result().result
        status = future.result().status
        self.get_logger().info(f'Goal result received with status: {status}')
        self._current_index += 1
        self._process_waypoints()

    def _process_waypoints(self):
        if(self._current_index >= len(self.waypoints)):
            self.get_logger().info('All waypoints processed')
            return
        
        wp = self.waypoints[self._current_index]
        aisle_id = str(wp.get('aisle_id', 'unknown'))
        pose = wp.get('pose', {})
        x = float(pose.get('x', 0.0))
        y = float(pose.get('y', 0.0))
        ps = PoseStamped()
        ps.header.frame_id = 'map'
        ps.header.stamp = self.get_clock().now().to_msg()
        ps.pose.position.x = x
        ps.pose.position.y = y
        ps.pose.orientation = get_quaternion()
        self.get_logger().info(f'[{self._current_index+1}/{len(self.waypoints)}] Sending goal to aisle {aisle_id}: ({x},{y})')
        # publish current aisle
        self.aisle_pub.publish(String(data=aisle_id))
        # tell counter to start counting for N seconds (param configurable)
        duration = 5
        if aisle_id.strip().lower() in ('navigating', 'ending'):
            self.count_trigger.publish(Int32(data=0))  # stop counting
        else:
            self.count_trigger.publish(Int32(data=duration))
        self._send_goal(ps)


def main(args=None):
    rclpy.init(args=args)
    node = WaypointRunner()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()