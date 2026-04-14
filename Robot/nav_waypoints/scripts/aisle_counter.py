#!/usr/bin/env python3

import rclpy
from rclpy.node import Node

from std_msgs.msg import String, Int32
from sensor_msgs.msg import Image
from ament_index_python.packages import get_package_share_directory
import os
import json

import numpy as np
import cv2
from ultralytics import YOLO
import requests

class AisleCounter(Node):
    def __init__(self):
        super().__init__('aisle_counter')

        # Parameters
        self.count_duration_sec = int(self.declare_parameter('count_duration_sec', 8).value)
        self.objects_json = "/home/sabal/aisle_objects.json"

        self.image_topic = str(self.declare_parameter('image_topic', '/camera/image_raw').value)
        self.depth_topic = str(self.declare_parameter('depth_topic', '/camera/depth/image_raw').value)
        self.server_url = self.declare_parameter(
            'server_url',
            'http://192.168.1.100:5000/update_inventory'
        ).value

        # State
        self.current_aisle = 'unknown'
        self.count_active = False

        self.weights_path = os.path.join(get_package_share_directory('nav_waypoints'), 'config', 'best.pt')
        self.model = YOLO(self.weights_path)
        self.objects_count = {}
        self.depth_image = None


        # Subscriptions
        self.create_subscription(String, 'current_aisle', self.aisle_cb, 10)
        self.create_subscription(Int32, 'start_count', self.start_cb, 10)
        self.create_subscription(Image, self.image_topic, self.image_cb, 10)
        self.create_subscription(Image, self.depth_topic, self.depth_cb, 10)

        self.get_logger().info('aisle_counter template started')

    def aisle_cb(self, msg: String):
        self.current_aisle = msg.data
        if self.current_aisle.strip().lower() in ('ending'):
            self.finish_count()


    def start_cb(self, msg: Int32):
        duration = int(msg.data)
        if duration <= 0:
            self.count_active = False
            self.get_logger().info(f'Stopping count for aisle={self.current_aisle}')
            return

        self.count_active = True

        self.get_logger().info(f'Start counting in aisle={self.current_aisle}')

    def image_cb(self, msg: Image):
        if not self.count_active:
            return
        
        depth_image = self.depth_image if self.depth_image is not None else np.zeros((msg.height, msg.width), dtype=np.float32)
        img_np =np.frombuffer(msg.data, dtype=np.uint8).reshape(msg.height, msg.width, -1)
        if msg.encoding == 'rgb8':
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        
        results = self.model.track(img_np, conf=0.5, persist=True)
        # Count unique IDs
        for result in results:
            if hasattr(result, 'boxes') and result.boxes.id is not None:
                boxes = result.boxes.xyxy.cpu().numpy()  # Bounding box coordinates
                classes = result.boxes.cls.cpu().numpy()  # Class IDs
                ids = result.boxes.id.cpu().numpy()  # Unique IDs from tracking

                for box, clas, obj_id in zip(boxes, classes, ids):
                    if self.depth_image is None:
                        continue
                    x1, y1, x2, y2 = map(int, box)
                    x1 = max(0, x1)
                    y1 = max(0, y1)
                    x2 = min(depth_image.shape[1]-1, x2)
                    y2 = min(depth_image.shape[0]-1, y2)
                    cls_name = self.model.names[int(clas)]
                    cx = int((x1 + x2) / 2)
                    cy = int((y1 + y2) / 2)
                    depth_value = float(depth_image[cy, cx])
                    if depth_value > 2.2:
                        continue
                    key = (self.current_aisle, cls_name)
                    if key not in self.objects_count:
                        self.objects_count[key] = set()
                    self.objects_count[key].add(obj_id.item())




    def depth_cb(self, msg: Image):
        if not self.count_active:
            return
        try:
            self.depth_image = np.frombuffer(msg.data, dtype=np.float32).reshape(msg.height, msg.width)
        except Exception as e:
            self.get_logger().error(f"Failed to process depth image: {e}")


    def finish_count(self):
        self.count_active = False
        self.get_logger().info(f'Finished aisle={self.current_aisle}')
        json_data = {}
        for (aisle, cls), ids in self.objects_count.items():
            if aisle not in json_data:
                json_data[aisle] = {}
            json_data[aisle][cls] = len(ids) 

        self.send_to_server(json_data)
        # Save to JSON file
        try:
            with open(self.objects_json, 'w') as f:
                json.dump(json_data, f, indent=2)
        except Exception as e:
            self.get_logger().error(f"Failed to save JSON: {e}")

        # Optional logging
        self.get_logger().info(f"Live counts (JSON updated): {json_data}")

    def send_to_server(self, data):
            try:
                response = requests.post(self.server_url, json=data)
                if response.status_code == 200:
                    self.get_logger().info("Data successfully sent to server")
                else:
                    self.get_logger().error(f"Failed to send data: {response.status_code} - {response.text}")
            except Exception as e:
                self.get_logger().error(f"Error sending data to server: {e}")

def main(args=None):
    rclpy.init(args=args)
    node = AisleCounter()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()